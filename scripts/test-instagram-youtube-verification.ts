/**
 * Test script for Instagram and YouTube verification
 * Tests that profile data is accurately extracted from BrightData responses
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { extractBioFromProfileData } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const INSTAGRAM_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_INSTAGRAM_PROFILE_SCRAPER_ID;
const YOUTUBE_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_YOUTUBE_PROFILE_SCRAPER_ID;

const MAX_WAIT_TIME = 3 * 60 * 1000; // 3 minutes
const POLL_INTERVAL = 10000; // 10 seconds

// Test accounts - using popular accounts that should have bios
const TEST_ACCOUNTS = {
  instagram: 'https://www.instagram.com/cristiano/',
  youtube: 'https://www.youtube.com/@MrBeast',
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

if (!BRIGHT_DATA_API_KEY) {
  console.error('❌ Missing BrightData API key');
  process.exit(1);
}

if (!INSTAGRAM_PROFILE_SCRAPER_ID) {
  console.error('❌ Missing Instagram profile scraper ID');
  process.exit(1);
}

if (!YOUTUBE_PROFILE_SCRAPER_ID) {
  console.error('❌ Missing YouTube profile scraper ID');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestUser() {
  const testEmail = 'test-profile-data@example.com';
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  let testUser = existingUser?.users?.find(u => u.email === testEmail);

  if (!testUser) {
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (error) throw error;
    testUser = newUser.user;
  }

  // Ensure profile exists
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', testUser.id)
    .maybeSingle();

  if (!existingProfile) {
    await supabaseAdmin
      .from('profiles')
      .insert({
        id: testUser.id,
        email: testEmail,
        role: 'standard',
        email_verified: true,
      });
  }

  return testUser;
}

async function triggerBrightData(platform: 'instagram' | 'youtube', url: string): Promise<string> {
  const datasetId = platform === 'instagram' ? INSTAGRAM_PROFILE_SCRAPER_ID : YOUTUBE_PROFILE_SCRAPER_ID;
  
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      appUrl = 'http://localhost:3000';
    }
  }

  if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    appUrl = `https://${appUrl}`;
  }

  appUrl = appUrl.replace(/\/+$/, '');
  const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/profile-webhook`);

  // Prepare URL (YouTube needs /about suffix)
  let profileUrl = url;
  if (platform === 'youtube' && !profileUrl.includes('/about')) {
    profileUrl = profileUrl.endsWith('/') ? `${profileUrl}about` : `${profileUrl}/about`;
  }

  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  const response = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ url: profileUrl }]),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BrightData trigger failed: ${response.status} ${errorText}`);
  }

  const triggerData = await response.json();
  let snapshotId: string | undefined;
  if (Array.isArray(triggerData) && triggerData.length > 0) {
    snapshotId = triggerData[0]?.snapshot_id || triggerData[0]?.id || triggerData[0]?.collection_id;
  } else if (triggerData && typeof triggerData === 'object') {
    snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
  }

  if (!snapshotId) {
    throw new Error('No snapshot_id returned from BrightData');
  }

  return snapshotId;
}

async function pollBrightDataSnapshot(snapshotId: string): Promise<any> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      const statusResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase();
      
      // Check if data is directly in the response
      let profileData: any = null;
      if (statusData.account_id || statusData.biography || statusData.nickname || statusData.Description || statusData.description) {
        profileData = statusData;
      } else if (statusData.data) {
        const data = Array.isArray(statusData.data) && statusData.data.length > 0 
          ? statusData.data[0] 
          : statusData.data;
        if (data && (data.account_id || data.biography || data.nickname || data.Description || data.description)) {
          profileData = data;
        }
      }

      if (profileData) {
        return profileData;
      }

      if (status === 'ready' || status === 'completed' || status === 'done' || status === 'success') {
        const dataResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/data`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
            },
          }
        );

        if (dataResponse.ok) {
          const dataPayload = await dataResponse.json();
          profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
            ? dataPayload[0] 
            : dataPayload;

          if (profileData && Object.keys(profileData).length > 0) {
            return profileData;
          }
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Snapshot failed with status: ${status}`);
      }

      if (attempts % 3 === 0) {
        console.log(`   ⏳ Still processing... (${elapsed}s elapsed)`);
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new Error(`Timeout: Snapshot not ready after ${MAX_WAIT_TIME / 1000}s`);
}

async function testPlatform(platform: 'instagram' | 'youtube', url: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${platform.toUpperCase()} Profile Data Extraction`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Profile URL: ${url}\n`);

  let snapshotId: string;
  let profileData: any = null;

  try {
    // Trigger BrightData
    console.log(`1️⃣  Triggering BrightData for ${platform}...`);
    snapshotId = await triggerBrightData(platform, url);
    console.log(`   ✅ Snapshot ID: ${snapshotId}\n`);

    // Poll for data
    console.log(`2️⃣  Polling BrightData (max 3 minutes)...`);
    try {
      profileData = await pollBrightDataSnapshot(snapshotId);
      console.log(`   ✅ Profile data received!\n`);
    } catch (pollError) {
      console.log(`   ⚠️  Polling timed out, checking database for webhook-processed data...`);
      
      // Check database - webhook might have processed it
      const testUser = await createTestUser();
      const { data: dbAccount } = await supabaseAdmin
        .from('social_accounts')
        .select('profile_data, snapshot_id')
        .eq('snapshot_id', snapshotId)
        .maybeSingle();
      
      if (dbAccount?.profile_data) {
        console.log(`   ✅ Data found in database (webhook processed)`);
        profileData = dbAccount.profile_data as any;
      } else {
        throw pollError;
      }
    }

    // Analyze profile data
    console.log(`3️⃣  Analyzing profile data structure...`);
    console.log(`   Data keys (${Object.keys(profileData).length} total):`);
    const keys = Object.keys(profileData);
    keys.slice(0, 20).forEach(key => {
      const value = profileData[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      const preview = typeof value === 'string' 
        ? value.substring(0, 50) + (value.length > 50 ? '...' : '')
        : Array.isArray(value)
        ? `[${value.length} items]`
        : typeof value === 'object' && value !== null
        ? '{object}'
        : String(value);
      console.log(`      - ${key}: ${type} = ${preview}`);
    });
    if (keys.length > 20) {
      console.log(`      ... and ${keys.length - 20} more fields`);
    }
    console.log('');

    // Extract bio
    console.log(`4️⃣  Testing bio extraction...`);
    const bioText = extractBioFromProfileData(profileData, platform);
    console.log(`   Platform: ${platform}`);
    console.log(`   Extracted bio: "${bioText}"`);
    console.log(`   Bio length: ${bioText.length} characters`);
    
    if (bioText) {
      console.log(`   ✅ Bio extraction: SUCCESS`);
    } else {
      console.log(`   ⚠️  Bio extraction: EMPTY (may be normal if account has no bio)`);
    }
    console.log('');

    // Check for expected fields
    console.log(`5️⃣  Checking expected profile fields...`);
    const expectedFields = platform === 'instagram' 
      ? ['biography', 'bio', 'account_id', 'nickname', 'followers', 'following', 'is_verified']
      : ['Description', 'description', 'channel_id', 'channel_name', 'subscriber_count', 'video_count'];
    
    const foundFields = expectedFields.filter(field => profileData[field] !== undefined);
    const missingFields = expectedFields.filter(field => profileData[field] === undefined);
    
    console.log(`   Expected fields: ${expectedFields.join(', ')}`);
    console.log(`   ✅ Found: ${foundFields.join(', ')}`);
    if (missingFields.length > 0) {
      console.log(`   ⚠️  Missing: ${missingFields.join(', ')}`);
    }
    console.log('');

    // Save to database for verification
    console.log(`6️⃣  Saving to database for verification...`);
    const testUser = await createTestUser();
    
    const { data: account, error } = await supabaseAdmin
      .from('social_accounts')
      .upsert({
        user_id: testUser.id,
        platform,
        profile_url: url,
        username: platform === 'instagram' ? profileData.username || profileData.account_id : profileData.channel_name,
        verification_code: 'TEST123',
        verification_status: 'PENDING',
        webhook_status: 'COMPLETED',
        profile_data: profileData,
        snapshot_id: snapshotId,
        last_verification_attempt_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform,profile_url',
      })
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Failed to save: ${error.message}`);
    } else {
      console.log(`   ✅ Saved to database`);
      console.log(`   Account ID: ${account.id}`);
      
      // Verify it was saved correctly
      const { data: verifyAccount } = await supabaseAdmin
        .from('social_accounts')
        .select('profile_data')
        .eq('id', account.id)
        .single();

      if (verifyAccount?.profile_data) {
        const savedData = verifyAccount.profile_data as any;
        console.log(`   ✅ Verified: profile_data contains ${Object.keys(savedData).length} fields`);
        console.log(`   ✅ Bio in saved data: "${extractBioFromProfileData(savedData, platform)}"`);
      } else {
        console.log(`   ❌ Verification failed: profile_data not found`);
      }
    }

    console.log(`\n✅ ${platform.toUpperCase()} test completed successfully!\n`);
    return { success: true, profileData, bioText };
  } catch (error) {
    console.error(`\n❌ ${platform.toUpperCase()} test failed:`, error);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 Instagram & YouTube Profile Data Test');
  console.log('========================================\n');

  const results = {
    instagram: null as any,
    youtube: null as any,
  };

  // Test Instagram
  results.instagram = await testPlatform('instagram', TEST_ACCOUNTS.instagram);

  // Test YouTube
  results.youtube = await testPlatform('youtube', TEST_ACCOUNTS.youtube);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Instagram: ${results.instagram?.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`YouTube: ${results.youtube?.success ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (results.instagram?.success) {
    console.log(`\nInstagram Bio: "${results.instagram.bioText}"`);
  }
  if (results.youtube?.success) {
    console.log(`\nYouTube Bio: "${results.youtube.bioText}"`);
  }

  const allPassed = results.instagram?.success && results.youtube?.success;
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(console.error);

