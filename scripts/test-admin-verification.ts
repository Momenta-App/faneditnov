/**
 * Test script for admin account verification
 * Tests verification with admin@momenta.app account and verification code U1FCR8
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const TIKTOK_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID;

const ADMIN_EMAIL = 'admin@momenta.app';
const VERIFICATION_CODE = 'U1FCR8';
const TEST_TIKTOK_URL = 'https://www.tiktok.com/@zacy.ae';
const MAX_WAIT_TIME = 3 * 60 * 1000; // 3 minutes
const POLL_INTERVAL = 10000; // 10 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

if (!BRIGHT_DATA_API_KEY) {
  console.error('❌ Missing BrightData API key');
  process.exit(1);
}

if (!TIKTOK_PROFILE_SCRAPER_ID) {
  console.error('❌ Missing TikTok profile scraper ID');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findOrCreateAdminUser() {
  console.log('1️⃣  Finding admin user...');
  
  // Find user by email
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  let adminUser = users?.users?.find(u => u.email === ADMIN_EMAIL);

  if (!adminUser) {
    console.log(`   ℹ️  User ${ADMIN_EMAIL} not found, creating...`);
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: 'temp-password-123',
      email_confirm: true,
    });

    if (error) {
      console.error('❌ Failed to create admin user:', error);
      throw error;
    }

    adminUser = newUser.user;
    console.log(`   ✅ Created admin user: ${adminUser.id}`);
  } else {
    console.log(`   ✅ Found admin user: ${adminUser.id}`);
  }

  // Ensure profile exists
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', adminUser.id)
    .maybeSingle();

  if (!existingProfile) {
    console.log('   Creating profile for admin user...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: adminUser.id,
        email: ADMIN_EMAIL,
        role: 'admin',
        email_verified: true,
      });

    if (profileError) {
      console.error('❌ Failed to create profile:', profileError);
      throw profileError;
    }
    console.log('   ✅ Profile created');
  } else {
    console.log('   ✅ Profile exists');
  }

  return adminUser;
}

async function createOrUpdateSocialAccount(userId: string) {
  console.log('2️⃣  Creating/updating social account...');
  console.log(`   Profile URL: ${TEST_TIKTOK_URL}`);
  console.log(`   Verification code: ${VERIFICATION_CODE}`);

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
    console.log('   ℹ️  Account already exists, updating with verification code...');
    const { data: updated, error } = await supabaseAdmin
      .from('social_accounts')
      .update({
        verification_code: VERIFICATION_CODE,
        verification_status: 'PENDING',
        webhook_status: 'PENDING',
        snapshot_id: null,
        profile_data: null,
        last_verification_attempt_at: null,
        verification_attempts: 0,
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
        verification_code: VERIFICATION_CODE,
        verification_status: 'PENDING',
        webhook_status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw error;
    account = created;
  }

  console.log(`   ✅ Account ID: ${account.id}`);
  return account;
}

async function triggerBrightDataVerification(accountId: string) {
  console.log('3️⃣  Triggering BrightData verification...');

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

async function pollBrightDataSnapshot(snapshotId: string, accountId: string): Promise<any> {
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
      const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase();
      
      // Check if data is directly in the response
      let profileData: any = null;
      if (statusData.account_id || statusData.biography || statusData.nickname) {
        console.log('   ✅ Data found directly in status response!');
        profileData = statusData;
      } else if (statusData.data) {
        const data = Array.isArray(statusData.data) && statusData.data.length > 0 
          ? statusData.data[0] 
          : statusData.data;
        if (data && (data.account_id || data.biography || data.nickname)) {
          console.log('   ✅ Data found in status response data field');
          profileData = data;
        }
      }

      // Check database - webhook might have processed it
      const { data: dbAccount } = await supabaseAdmin
        .from('social_accounts')
        .select('profile_data, webhook_status, verification_status')
        .eq('id', accountId)
        .maybeSingle();
      
      if (dbAccount?.profile_data && dbAccount.webhook_status === 'COMPLETED') {
        console.log('   ✅ Data found in database (webhook processed)');
        return dbAccount.profile_data as any;
      }

      if (profileData) {
        return profileData;
      }

      if (status === 'ready' || status === 'completed' || status === 'done' || status === 'success') {
        console.log('   ✅ Snapshot ready, downloading data...');
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

      console.log(`   Status: ${status || 'undefined'}`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      console.error(`   ❌ Error polling:`, error);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new Error(`Timeout: Snapshot not ready after ${MAX_WAIT_TIME / 1000}s`);
}

async function verifyDatabaseData(accountId: string, expectedSnapshotId: string, expectedCode: string) {
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
    const bioFields = ['biography', 'bio', 'Description', 'description'];
    const foundBioFields = bioFields.filter(field => profileData[field]);
    
    if (foundBioFields.length > 0) {
      const bioField = foundBioFields[0];
      const bioText = profileData[bioField];
      console.log(`   Bio field: ${bioField}`);
      console.log(`   Bio text: "${bioText}"`);
      console.log(`   Looking for code: "${expectedCode}"`);
      
      const codeFound = bioText?.toLowerCase().includes(expectedCode.toLowerCase());
      if (codeFound) {
        console.log('   ✅ Verification code FOUND in bio!');
      } else {
        console.log('   ❌ Verification code NOT found in bio');
      }
    }
  } else {
    console.log('❌ profile_data: MISSING');
  }

  // Check verification_status
  console.log(`\n📋 Verification Status:`);
  console.log(`   verification_status: ${account.verification_status}`);
  console.log(`   verification_attempts: ${account.verification_attempts || 0}`);
  console.log(`   last_verification_attempt_at: ${account.last_verification_attempt_at || 'null'}`);

  return account;
}

async function main() {
  console.log('🚀 Admin Verification Test');
  console.log('=========================\n');
  console.log(`Testing with:`);
  console.log(`  Account: ${ADMIN_EMAIL}`);
  console.log(`  TikTok: ${TEST_TIKTOK_URL}`);
  console.log(`  Verification Code: ${VERIFICATION_CODE}\n`);

  try {
    // Step 1: Find/create admin user
    const adminUser = await findOrCreateAdminUser();
    console.log('');

    // Step 2: Create/update social account
    const account = await createOrUpdateSocialAccount(adminUser.id);
    console.log('');

    // Step 3: Trigger BrightData
    const snapshotId = await triggerBrightDataVerification(account.id);
    console.log('');

    // Step 4: Poll BrightData
    console.log('⏳ Waiting for BrightData to process (max 3 minutes)...\n');
    
    let profileData;
    try {
      profileData = await pollBrightDataSnapshot(snapshotId, account.id);
      console.log('   ✅ Profile data received!');
      console.log(`   Data keys: ${Object.keys(profileData).slice(0, 10).join(', ')}...\n`);
      
      // Save data to database (simulating webhook/status endpoint)
      console.log('4b️⃣  Saving profile data to database...');
      const { extractBioFromProfileData, verifyCodeInBio } = await import('../src/lib/social-account-helpers');
      
      const bioText = extractBioFromProfileData(profileData, 'tiktok');
      const codeFound = verifyCodeInBio(bioText, VERIFICATION_CODE);
      
      console.log(`   Bio text: "${bioText}"`);
      console.log(`   Verification code: ${VERIFICATION_CODE}`);
      console.log(`   Code found: ${codeFound ? '✅ YES' : '❌ NO'}`);
      
      const updateData: any = {
        profile_data: profileData,
        webhook_status: 'COMPLETED',
        last_verification_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (codeFound) {
        updateData.verification_status = 'VERIFIED';
        updateData.verification_attempts = 0;
        console.log('   ✅ Verification SUCCESSFUL - code found in bio!');
      } else {
        updateData.verification_status = 'FAILED';
        updateData.verification_attempts = (account.verification_attempts || 0) + 1;
        console.log('   ❌ Verification FAILED - code not found in bio');
      }

      const { error: updateError } = await supabaseAdmin
        .from('social_accounts')
        .update(updateData)
        .eq('id', account.id);

      if (updateError) {
        console.error('   ❌ Failed to save profile data:', updateError);
        throw updateError;
      }
      
      console.log(`   ✅ Profile data saved to database`);
      console.log(`   Verification status: ${updateData.verification_status}\n`);
    } catch (error) {
      console.error('   ❌ Failed to get/save profile data:', error);
    }

    // Step 5: Wait for webhook
    console.log('⏳ Waiting 5 seconds for webhook to process...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Verify database
    const dbAccount = await verifyDatabaseData(account.id, snapshotId, VERIFICATION_CODE);
    console.log('');

    // Final summary
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log(`✅ Account ID: ${account.id}`);
    console.log(`✅ Snapshot ID: ${snapshotId}`);
    console.log(`${dbAccount.profile_data ? '✅' : '❌'} Profile data saved: ${dbAccount.profile_data ? 'YES' : 'NO'}`);
    console.log(`${dbAccount.webhook_status === 'COMPLETED' ? '✅' : '⚠️ '} Webhook status: ${dbAccount.webhook_status || 'PENDING'}`);
    console.log(`${dbAccount.verification_status === 'VERIFIED' ? '✅' : dbAccount.verification_status === 'FAILED' ? '❌' : '⚠️ '} Verification status: ${dbAccount.verification_status}`);

    if (!dbAccount.profile_data) {
      console.log('\n❌ TEST FAILED: Profile data not saved to database');
      process.exit(1);
    } else if (dbAccount.verification_status === 'VERIFIED') {
      console.log('\n✅ TEST PASSED: Verification successful - code found in bio!');
    } else if (dbAccount.verification_status === 'FAILED') {
      console.log('\n⚠️  TEST PARTIAL: Data saved but verification failed - code not found in bio');
      console.log('   This is expected if the code is not actually in the bio');
    } else {
      console.log('\n⚠️  TEST INCOMPLETE: Data saved but verification status unclear');
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

