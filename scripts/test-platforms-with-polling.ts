/**
 * Test Instagram, TikTok, and YouTube with manual polling fallback
 * This simulates what the status endpoint does
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateVerificationCode, normalizeProfileUrl, extractBioFromProfileData, verifyCodeInBio } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const TIKTOK_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID;
const INSTAGRAM_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_INSTAGRAM_PROFILE_SCRAPER_ID;
const YOUTUBE_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_YOUTUBE_PROFILE_SCRAPER_ID;

const TEST_ACCOUNTS = {
  tiktok: 'https://www.tiktok.com/@zacy.ae',
  instagram: 'https://www.instagram.com/cristiano/',
  youtube: 'https://www.youtube.com/@MrBeast',
};

const MAX_WAIT_TIME = 3 * 60 * 1000; // 3 minutes
const POLL_INTERVAL = 10000; // 10 seconds

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestUser() {
  const testEmail = `test-platforms-${Date.now()}@example.com`;
  const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  });
  await supabaseAdmin.from('profiles').insert({
    id: newUser.user.id,
    email: testEmail,
    role: 'standard',
    email_verified: true,
  }).then(({ error }) => {
    if (error && !error.message.includes('duplicate')) throw error;
  });
  return newUser.user;
}

async function createAccount(userId: string, platform: 'tiktok' | 'instagram' | 'youtube', url: string) {
  const normalizedUrl = normalizeProfileUrl(url);
  const verificationCode = generateVerificationCode();
  
  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .insert({
      user_id: userId,
      platform,
      profile_url: normalizedUrl,
      verification_code: verificationCode,
      verification_status: 'PENDING',
    })
    .select()
    .single();
  
  return account;
}

async function triggerBrightData(platform: 'tiktok' | 'instagram' | 'youtube', url: string, accountId: string) {
  const datasetId = platform === 'tiktok' ? TIKTOK_PROFILE_SCRAPER_ID :
                    platform === 'instagram' ? INSTAGRAM_PROFILE_SCRAPER_ID :
                    YOUTUBE_PROFILE_SCRAPER_ID;

  let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (!appUrl.startsWith('http')) appUrl = `https://${appUrl}`;
  appUrl = appUrl.replace(/\/+$/, '');
  
  let profileUrl = url;
  if (platform === 'youtube' && !profileUrl.includes('/about')) {
    profileUrl = profileUrl.endsWith('/') ? `${profileUrl}about` : `${profileUrl}/about`;
  }

  const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/profile-webhook`);
  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  const response = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ url: profileUrl }]),
  });

  if (!response.ok) throw new Error(`Trigger failed: ${response.status}`);

  const triggerData = await response.json();
  const snapshotId = Array.isArray(triggerData) && triggerData[0]?.snapshot_id 
    ? triggerData[0].snapshot_id 
    : triggerData.snapshot_id;

  if (!snapshotId) throw new Error('No snapshot_id returned');

  await supabaseAdmin
    .from('social_accounts')
    .update({ snapshot_id: snapshotId, webhook_status: 'PENDING' })
    .eq('id', accountId);

  return snapshotId;
}

async function pollAndProcess(accountId: string, snapshotId: string, platform: string) {
  console.log(`  Polling BrightData for data...`);
  
  for (let attempt = 0; attempt < 18; attempt++) { // 3 minutes max
    try {
      const statusResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        { headers: { 'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}` } }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        // Check if data is directly in response
        let profileData = null;
        if (statusData.url || statusData.handle || statusData.Description || statusData.biography) {
          profileData = statusData;
        } else if (statusData.status === 'ready' || statusData.status === 'completed') {
          const dataResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/data`,
            { headers: { 'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}` } }
          );
          if (dataResponse.ok) {
            const dataPayload = await dataResponse.json();
            profileData = Array.isArray(dataPayload) ? dataPayload[0] : dataPayload;
          }
        }

        if (profileData) {
          // Get account to get verification code
          const { data: account } = await supabaseAdmin
            .from('social_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

          if (!account) throw new Error('Account not found');

          const bioText = extractBioFromProfileData(profileData, account.platform);
          const codeFound = verifyCodeInBio(bioText, account.verification_code);

          const updateData: any = {
            profile_data: profileData,
            webhook_status: 'COMPLETED',
            last_verification_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (codeFound) {
            updateData.verification_status = 'VERIFIED';
            updateData.verification_attempts = 0;
          } else {
            updateData.verification_status = 'FAILED';
            updateData.verification_attempts = (account.verification_attempts || 0) + 1;
          }

          await supabaseAdmin
            .from('social_accounts')
            .update(updateData)
            .eq('id', accountId);

          console.log(`  ✅ Data stored successfully`);
          console.log(`  ✅ Verification status: ${updateData.verification_status}`);
          console.log(`  ✅ Bio: "${bioText.substring(0, 80)}${bioText.length > 80 ? '...' : ''}"`);
          console.log(`  ✅ Code found: ${codeFound ? 'YES' : 'NO'}`);
          
          return true;
        }
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      if (attempt < 17) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Timeout');
}

async function testPlatform(platform: 'tiktok' | 'instagram' | 'youtube') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${platform.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const url = TEST_ACCOUNTS[platform];
  console.log(`URL: ${url}`);

  try {
    const user = await createTestUser();
    const account = await createAccount(user.id, platform, url);
    console.log(`✅ Account created: ${account.id}`);
    console.log(`   Code: ${account.verification_code}`);

    const snapshotId = await triggerBrightData(platform, url, account.id);
    console.log(`✅ BrightData triggered: ${snapshotId}`);

    await pollAndProcess(account.id, snapshotId, platform);

    // Verify in database
    const { data: finalAccount } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('id', account.id)
      .single();

    console.log(`\n📊 Final Database State:`);
    console.log(`   Has profile_data: ${finalAccount?.profile_data ? '✅ YES' : '❌ NO'}`);
    console.log(`   Webhook status: ${finalAccount?.webhook_status || 'NULL'}`);
    console.log(`   Verification status: ${finalAccount?.verification_status}`);
    
    if (finalAccount?.profile_data) {
      const pd = finalAccount.profile_data as any;
      console.log(`   Profile data keys: ${Object.keys(pd).slice(0, 8).join(', ')}...`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing All Platforms with Polling\n');

  const results = {
    tiktok: await testPlatform('tiktok'),
    instagram: await testPlatform('instagram'),
    youtube: await testPlatform('youtube'),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`TikTok: ${results.tiktok ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Instagram: ${results.instagram ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`YouTube: ${results.youtube ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);
  process.exit(allPassed ? 0 : 1);
}

main();

