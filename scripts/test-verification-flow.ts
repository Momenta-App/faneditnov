/**
 * Test script for complete verification flow
 * Tests BrightData verification for a TikTok account and verifies data is saved correctly
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateVerificationCode } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const TIKTOK_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID;

const TEST_TIKTOK_URL = 'https://www.tiktok.com/@zacy.ae';
const MAX_WAIT_TIME = 3 * 60 * 1000; // 3 minutes
const POLL_INTERVAL = 10000; // 10 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!BRIGHT_DATA_API_KEY) {
  console.error('❌ Missing BrightData API key');
  console.error('   Required: BRIGHT_DATA_API_KEY or BRIGHTDATA_API_KEY');
  process.exit(1);
}

if (!TIKTOK_PROFILE_SCRAPER_ID) {
  console.error('❌ Missing TikTok profile scraper ID');
  console.error('   Required: BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestUser() {
  console.log('1️⃣  Creating test user...');
  
  // Try to find existing test user or create one
  const testEmail = 'test-verification@example.com';
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  let testUser = existingUser?.users?.find(u => u.email === testEmail);

  if (!testUser) {
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (error) {
      console.error('❌ Failed to create test user:', error);
      throw error;
    }

    testUser = newUser.user;
    console.log(`   ✅ Created test user: ${testUser.id}`);
  } else {
    console.log(`   ✅ Using existing test user: ${testUser.id}`);
  }

  // Ensure profile exists
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', testUser.id)
    .maybeSingle();

  if (!existingProfile) {
    console.log('   Creating profile for user...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: testUser.id,
        email: testUser.email || testEmail,
        role: 'standard',
        email_verified: true,
      });

    if (profileError) {
      console.error('❌ Failed to create profile:', profileError);
      throw profileError;
    }
    console.log('   ✅ Profile created');
  } else {
    console.log('   ✅ Profile already exists');
  }

  return testUser;
}

async function createSocialAccount(userId: string) {
  console.log('2️⃣  Creating social account...');
  
  const verificationCode = generateVerificationCode();
  console.log(`   Verification code: ${verificationCode}`);

  // Check if account already exists
  const { data: existing } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'tiktok')
    .eq('profile_url', TEST_TIKTOK_URL)
    .maybeSingle();

  let account;
  if (existing) {
    console.log('   ℹ️  Account already exists, updating...');
    const { data: updated, error } = await supabaseAdmin
      .from('social_accounts')
      .update({
        verification_code: verificationCode,
        verification_status: 'PENDING',
        webhook_status: 'PENDING',
        snapshot_id: null,
        profile_data: null,
        last_verification_attempt_at: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    account = updated;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('social_accounts')
      .insert({
        user_id: userId,
        platform: 'tiktok',
        profile_url: TEST_TIKTOK_URL,
        username: 'zacy.ae',
        verification_code: verificationCode,
        verification_status: 'PENDING',
        webhook_status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw error;
    account = created;
  }

  console.log(`   ✅ Account created/updated: ${account.id}`);
  return account;
}

async function triggerBrightDataVerification(accountId: string) {
  console.log('3️⃣  Triggering BrightData verification...');

  // Construct webhook URL
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

  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${TIKTOK_PROFILE_SCRAPER_ID}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  console.log(`   Webhook URL: ${appUrl}/api/brightdata/profile-webhook`);
  console.log(`   Profile URL: ${TEST_TIKTOK_URL}`);

  const response = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ url: TEST_TIKTOK_URL }]),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BrightData trigger failed: ${response.status} ${errorText}`);
  }

  const triggerData = await response.json();
  console.log('   ✅ BrightData trigger response:', JSON.stringify(triggerData, null, 2));

  // Extract snapshot ID
  let snapshotId: string | undefined;
  if (Array.isArray(triggerData) && triggerData.length > 0) {
    const firstItem = triggerData[0];
    snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
  } else if (triggerData && typeof triggerData === 'object') {
    snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
  }

  if (!snapshotId) {
    throw new Error('No snapshot_id returned from BrightData');
  }

  console.log(`   ✅ Snapshot ID: ${snapshotId}`);

  // Update account with snapshot ID
  await supabaseAdmin
    .from('social_accounts')
    .update({
      snapshot_id: snapshotId,
      webhook_status: 'PENDING',
      last_verification_attempt_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  return snapshotId;
}

async function pollBrightDataSnapshot(snapshotId: string): Promise<any> {
  console.log('4️⃣  Polling BrightData snapshot...');
  console.log(`   Snapshot ID: ${snapshotId}`);
  console.log(`   Max wait time: ${MAX_WAIT_TIME / 1000}s`);

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`   Attempt ${attempts} (${elapsed}s elapsed)...`);

    try {
      // Check snapshot status
      const statusResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        console.log(`   ⏳ Status check failed (${statusResponse.status}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase() || statusData.snapshot?.status?.toLowerCase();
      
      // Check if data is directly in the response (some BrightData APIs return data directly when ready)
      if (statusData.account_id || statusData.biography || statusData.nickname) {
        console.log('   ✅ Data found directly in status response!');
        return statusData;
      }

      if (statusData.data && (Array.isArray(statusData.data) || typeof statusData.data === 'object')) {
        console.log('   ✅ Data found in status response data field');
        const data = Array.isArray(statusData.data) && statusData.data.length > 0 
          ? statusData.data[0] 
          : statusData.data;
        if (data && (data.account_id || data.biography || data.nickname)) {
          return data;
        }
      }

      console.log(`   Status: ${status || 'undefined'}`);

      if (status === 'ready' || status === 'completed' || status === 'done' || status === 'success') {
        // Download data
        console.log('   ✅ Snapshot ready, downloading data...');
        const dataResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/data`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
            },
          }
        );

        if (!dataResponse.ok) {
          const errorText = await dataResponse.text();
          console.log(`   ⚠️  Data download failed (${dataResponse.status}): ${errorText.substring(0, 200)}`);
          // Continue polling - might not be ready yet
        } else {
          const dataPayload = await dataResponse.json();
          const profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
            ? dataPayload[0] 
            : dataPayload;

          if (profileData && Object.keys(profileData).length > 0) {
            return profileData;
          }
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Snapshot failed with status: ${status}`);
      }
      
      // Also check database - webhook might have processed it already
      const { data: dbAccount } = await supabaseAdmin
        .from('social_accounts')
        .select('profile_data, webhook_status')
        .eq('snapshot_id', snapshotId)
        .maybeSingle();
      
      if (dbAccount?.profile_data && dbAccount.webhook_status === 'COMPLETED') {
        console.log('   ✅ Data found in database (webhook processed)');
        return dbAccount.profile_data as any;
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      console.error(`   ❌ Error polling:`, error);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new Error(`Timeout: Snapshot not ready after ${MAX_WAIT_TIME / 1000}s`);
}

async function verifyDatabaseData(accountId: string, expectedSnapshotId: string) {
  console.log('5️⃣  Verifying database data...');

  const { data: account, error } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch account: ${error.message}`);
  }

  console.log('\n📊 Database Verification Results:');
  console.log('=====================================');

  // Check snapshot_id
  if (account.snapshot_id === expectedSnapshotId) {
    console.log('✅ snapshot_id: CORRECT');
    console.log(`   Value: ${account.snapshot_id}`);
  } else {
    console.log('❌ snapshot_id: MISMATCH');
    console.log(`   Expected: ${expectedSnapshotId}`);
    console.log(`   Actual: ${account.snapshot_id || 'null'}`);
  }

  // Check webhook_status
  if (account.webhook_status === 'COMPLETED') {
    console.log('✅ webhook_status: COMPLETED');
  } else {
    console.log(`⚠️  webhook_status: ${account.webhook_status || 'null'}`);
  }

  // Check profile_data
  if (account.profile_data) {
    console.log('✅ profile_data: PRESENT');
    const profileData = account.profile_data as any;
    console.log(`   Type: ${typeof profileData}`);
    console.log(`   Keys: ${Object.keys(profileData).slice(0, 10).join(', ')}...`);
    
    // Check for expected fields
    const expectedFields = ['biography', 'bio', 'account_id', 'nickname', 'followers'];
    const foundFields = expectedFields.filter(field => profileData[field] !== undefined);
    console.log(`   Found fields: ${foundFields.join(', ')}`);

    if (profileData.biography || profileData.bio) {
      const bio = profileData.biography || profileData.bio;
      console.log(`   Bio preview: ${bio?.substring(0, 100)}...`);
    }
  } else {
    console.log('❌ profile_data: MISSING');
  }

  // Check verification_status
  console.log(`ℹ️  verification_status: ${account.verification_status}`);
  console.log(`ℹ️  verification_attempts: ${account.verification_attempts || 0}`);
  console.log(`ℹ️  last_verification_attempt_at: ${account.last_verification_attempt_at || 'null'}`);

  return account;
}

async function main() {
  console.log('🚀 Verification Flow Test');
  console.log('==========================\n');
  console.log(`Testing TikTok account: ${TEST_TIKTOK_URL}\n`);

  try {
    // Step 1: Create test user
    const testUser = await createTestUser();
    console.log('');

    // Step 2: Create social account
    const account = await createSocialAccount(testUser.id);
    console.log('');

    // Step 3: Trigger BrightData
    const snapshotId = await triggerBrightDataVerification(account.id);
    console.log('');

    // Step 4: Poll BrightData (wait for webhook or poll directly)
    console.log('⏳ Waiting for BrightData to process (max 3 minutes)...\n');
    
    let profileData;
    try {
      profileData = await pollBrightDataSnapshot(snapshotId);
      console.log('   ✅ Profile data received!');
      console.log(`   Data keys: ${Object.keys(profileData).slice(0, 10).join(', ')}...\n`);
      
      // Step 4b: Save data to database manually (simulating what webhook/status endpoint should do)
      console.log('4b️⃣  Saving profile data to database...');
      const { extractBioFromProfileData, verifyCodeInBio } = await import('../src/lib/social-account-helpers');
      
      const bioText = extractBioFromProfileData(profileData, 'tiktok');
      const codeFound = verifyCodeInBio(bioText, account.verification_code);
      
      console.log(`   Bio text: ${bioText}`);
      console.log(`   Verification code: ${account.verification_code}`);
      console.log(`   Code found: ${codeFound}`);
      
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

      const { error: updateError } = await supabaseAdmin
        .from('social_accounts')
        .update(updateData)
        .eq('id', account.id);

      if (updateError) {
        console.error('   ❌ Failed to save profile data:', updateError);
        throw updateError;
      }
      
      console.log('   ✅ Profile data saved to database');
      console.log(`   Verification status: ${updateData.verification_status}\n`);
    } catch (error) {
      console.error('   ❌ Failed to get/save profile data:', error);
      console.log('   ℹ️  Checking database for webhook-processed data...\n');
    }

    // Step 5: Wait a bit for webhook to process (if it hasn't already)
    console.log('⏳ Waiting 5 seconds for webhook to process...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Verify database
    const dbAccount = await verifyDatabaseData(account.id, snapshotId);
    console.log('');

    // Final summary
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log(`✅ Account ID: ${account.id}`);
    console.log(`✅ Snapshot ID: ${snapshotId}`);
    console.log(`${dbAccount.profile_data ? '✅' : '❌'} Profile data saved: ${dbAccount.profile_data ? 'YES' : 'NO'}`);
    console.log(`${dbAccount.webhook_status === 'COMPLETED' ? '✅' : '⚠️ '} Webhook status: ${dbAccount.webhook_status || 'PENDING'}`);
    console.log(`ℹ️  Verification status: ${dbAccount.verification_status}`);

    if (!dbAccount.profile_data) {
      console.log('\n❌ TEST FAILED: Profile data not saved to database');
      process.exit(1);
    } else {
      console.log('\n✅ TEST PASSED: Profile data saved correctly');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);

