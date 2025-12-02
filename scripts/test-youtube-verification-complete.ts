/**
 * Complete YouTube verification test
 * Triggers BrightData, captures webhook, saves results, and reviews them
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { generateVerificationCode, normalizeProfileUrl } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const YOUTUBE_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_YOUTUBE_PROFILE_SCRAPER_ID;

// Test with a popular YouTube channel
const TEST_YOUTUBE_URL = 'https://www.youtube.com/@MrBeast';
const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 10000; // 10 seconds

interface TestResults {
  timestamp: string;
  testUrl: string;
  accountId?: string;
  verificationCode: string;
  snapshotId?: string;
  triggerResponse?: any;
  webhookReceived: boolean;
  webhookPayload?: any;
  accountAfterWebhook?: any;
  profileData?: any;
  bioText?: string;
  verificationStatus?: string;
  errors: string[];
  logs: string[];
}

const results: TestResults = {
  timestamp: new Date().toISOString(),
  testUrl: TEST_YOUTUBE_URL,
  verificationCode: generateVerificationCode(),
  webhookReceived: false,
  errors: [],
  logs: [],
};

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(message);
  results.logs.push(logMessage);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

if (!BRIGHT_DATA_API_KEY) {
  console.error('❌ Missing BrightData API key');
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
  log('1️⃣  Creating test user...');
  
  const testEmail = `test-youtube-${Date.now()}@example.com`;
  
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (error) {
    results.errors.push(`Failed to create user: ${error.message}`);
    throw error;
  }

  log(`   ✅ Created test user: ${newUser.user.id}`);

  // Ensure profile exists
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: newUser.user.id,
      email: testEmail,
      role: 'standard',
      email_verified: true,
    });

  if (profileError && !profileError.message.includes('duplicate')) {
    results.errors.push(`Failed to create profile: ${profileError.message}`);
    throw profileError;
  }

  log('   ✅ Profile created');
  return newUser.user;
}

async function createSocialAccount(userId: string) {
  log('2️⃣  Creating social account...');
  
  const normalizedUrl = normalizeProfileUrl(TEST_YOUTUBE_URL);
  log(`   Normalized URL: ${normalizedUrl}`);
  log(`   Verification code: ${results.verificationCode}`);

  // Check if account exists
  const { data: existing } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'youtube')
    .eq('profile_url', normalizedUrl)
    .maybeSingle();

  let account;
  if (existing) {
    log('   ℹ️  Account exists, updating...');
    const { data: updated, error } = await supabaseAdmin
      .from('social_accounts')
      .update({
        verification_code: results.verificationCode,
        verification_status: 'PENDING',
        webhook_status: null,
        snapshot_id: null,
        profile_data: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      results.errors.push(`Failed to update account: ${error.message}`);
      throw error;
    }
    account = updated;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('social_accounts')
      .insert({
        user_id: userId,
        platform: 'youtube',
        profile_url: normalizedUrl,
        username: 'MrBeast',
        verification_code: results.verificationCode,
        verification_status: 'PENDING',
      })
      .select()
      .single();

    if (error) {
      results.errors.push(`Failed to create account: ${error.message}`);
      throw error;
    }
    account = created;
  }

  results.accountId = account.id;
  log(`   ✅ Account ID: ${account.id}`);
  log(`   ✅ Profile URL: ${account.profile_url}`);
  log(`   ✅ Webhook status: ${account.webhook_status || 'NULL'}`);
  
  return account;
}

async function triggerBrightData(accountId: string) {
  log('3️⃣  Triggering BrightData verification...');

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
  let profileUrl = TEST_YOUTUBE_URL;
  if (!profileUrl.includes('/about')) {
    profileUrl = profileUrl.endsWith('/') ? `${profileUrl}about` : `${profileUrl}/about`;
  }

  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${YOUTUBE_PROFILE_SCRAPER_ID}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  log(`   Webhook URL: ${appUrl}/api/brightdata/profile-webhook`);
  log(`   Profile URL sent to BrightData: ${profileUrl}`);

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
    const errorMsg = `BrightData trigger failed: ${response.status} ${errorText}`;
    results.errors.push(errorMsg);
    throw new Error(errorMsg);
  }

  const triggerData = await response.json();
  results.triggerResponse = triggerData;
  log('   ✅ BrightData trigger response received');
  log(`   Response: ${JSON.stringify(triggerData, null, 2)}`);

  // Extract snapshot ID
  let snapshotId: string | undefined;
  if (Array.isArray(triggerData) && triggerData.length > 0) {
    const firstItem = triggerData[0];
    snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
  } else if (triggerData && typeof triggerData === 'object') {
    snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
  }

  if (!snapshotId) {
    const errorMsg = 'No snapshot_id returned from BrightData';
    results.errors.push(errorMsg);
    throw new Error(errorMsg);
  }

  results.snapshotId = snapshotId;
  log(`   ✅ Snapshot ID: ${snapshotId}`);

  // Update account with snapshot_id
  const { error: updateError } = await supabaseAdmin
    .from('social_accounts')
    .update({
      snapshot_id: snapshotId,
      webhook_status: 'PENDING',
      last_verification_attempt_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  if (updateError) {
    results.errors.push(`Failed to update account with snapshot_id: ${updateError.message}`);
    log(`   ⚠️  Warning: Failed to update snapshot_id: ${updateError.message}`);
  } else {
    log('   ✅ Account updated with snapshot_id');
  }

  return snapshotId;
}

async function pollForWebhook(accountId: string, snapshotId: string) {
  log('4️⃣  Waiting for webhook (max 5 minutes)...');
  
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = Math.floor(MAX_WAIT_TIME / POLL_INTERVAL);

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Check database for webhook completion
    const { data: account, error } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      log(`   ⚠️  Error checking account: ${error.message}`);
    } else if (account) {
      if (account.webhook_status === 'COMPLETED') {
        log(`   ✅ Webhook completed after ${elapsed}s (${attempts} attempts)`);
        results.webhookReceived = true;
        results.accountAfterWebhook = account;
        results.profileData = account.profile_data;
        results.verificationStatus = account.verification_status;
        return account;
      } else if (account.webhook_status === 'FAILED') {
        log(`   ❌ Webhook failed after ${elapsed}s`);
        results.accountAfterWebhook = account;
        results.errors.push('Webhook status is FAILED');
        return account;
      }
    }

    if (attempts % 6 === 0) {
      log(`   ⏳ Still waiting... (${elapsed}s elapsed, status: ${account?.webhook_status || 'NULL'})`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  log(`   ⚠️  Timeout after ${MAX_WAIT_TIME / 1000}s`);
  
  // Get final account state
  const { data: finalAccount } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .single();
  
  results.accountAfterWebhook = finalAccount;
  return finalAccount;
}

async function pollBrightDataDirectly(snapshotId: string) {
  log('5️⃣  Polling BrightData directly for data...');
  
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = Math.floor(MAX_WAIT_TIME / POLL_INTERVAL);

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    attempts++;
    
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

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase();
        
        if (status === 'ready' || status === 'completed' || status === 'done') {
          log(`   ✅ Snapshot ready, downloading data...`);
          
          // Download data
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
            const profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
              ? dataPayload[0] 
              : dataPayload;
            
            log(`   ✅ Data downloaded successfully`);
            results.profileData = profileData;
            return profileData;
          }
        } else if (status === 'failed' || status === 'error') {
          results.errors.push(`BrightData snapshot failed: ${status}`);
          return null;
        }
      }
    } catch (error) {
      log(`   ⚠️  Error polling: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } else {
      break;
    }
  }

  log(`   ⚠️  Timeout polling BrightData`);
  return null;
}

async function reviewResults() {
  log('\n6️⃣  Reviewing results...');
  log('='.repeat(60));
  
  log(`\n📊 Test Summary:`);
  log(`   Test URL: ${results.testUrl}`);
  log(`   Account ID: ${results.accountId || 'N/A'}`);
  log(`   Snapshot ID: ${results.snapshotId || 'N/A'}`);
  log(`   Verification Code: ${results.verificationCode}`);
  log(`   Webhook Received: ${results.webhookReceived ? '✅ YES' : '❌ NO'}`);
  log(`   Verification Status: ${results.verificationStatus || 'N/A'}`);
  
  if (results.accountAfterWebhook) {
    log(`\n📝 Account State After Webhook:`);
    log(`   Webhook Status: ${results.accountAfterWebhook.webhook_status || 'NULL'}`);
    log(`   Verification Status: ${results.accountAfterWebhook.verification_status}`);
    log(`   Snapshot ID: ${results.accountAfterWebhook.snapshot_id || 'NULL'}`);
    log(`   Has Profile Data: ${results.accountAfterWebhook.profile_data ? '✅ YES' : '❌ NO'}`);
    
    if (results.accountAfterWebhook.profile_data) {
      const profileData = results.accountAfterWebhook.profile_data as any;
      log(`   Profile Data Keys: ${Object.keys(profileData).slice(0, 10).join(', ')}...`);
      
      // Extract bio
      const bioText = profileData.Description || profileData.description || profileData.bio || '';
      results.bioText = bioText;
      log(`   Bio Text: "${bioText.substring(0, 100)}${bioText.length > 100 ? '...' : ''}"`);
      log(`   Code in Bio: ${bioText.includes(results.verificationCode) ? '✅ YES' : '❌ NO'}`);
    }
  }
  
  if (results.errors.length > 0) {
    log(`\n❌ Errors:`);
    results.errors.forEach(error => log(`   - ${error}`));
  }
  
  log('\n' + '='.repeat(60));
}

async function saveResults() {
  const filename = `test-results-${Date.now()}.json`;
  const filepath = `scripts/${filename}`;
  
  writeFileSync(filepath, JSON.stringify(results, null, 2));
  log(`\n💾 Results saved to: ${filepath}`);
}

async function main() {
  try {
    log('🚀 Starting YouTube Verification Test');
    log('='.repeat(60));
    
    const user = await createTestUser();
    const account = await createSocialAccount(user.id);
    const snapshotId = await triggerBrightData(account.id);
    
    // Wait for webhook
    const accountAfterWebhook = await pollForWebhook(account.id, snapshotId);
    
    // If webhook didn't arrive, try polling BrightData directly
    if (!results.webhookReceived && snapshotId) {
      log('\n⚠️  Webhook not received, polling BrightData directly...');
      const profileData = await pollBrightDataDirectly(snapshotId);
      if (profileData) {
        results.profileData = profileData;
      }
    }
    
    await reviewResults();
    await saveResults();
    
    if (results.errors.length > 0) {
      log('\n❌ Test completed with errors');
      process.exit(1);
    } else if (results.webhookReceived) {
      log('\n✅ Test completed successfully - webhook received!');
    } else {
      log('\n⚠️  Test completed but webhook was not received');
    }
  } catch (error) {
    log(`\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    results.errors.push(error instanceof Error ? error.message : String(error));
    await saveResults();
    process.exit(1);
  }
}

main();

