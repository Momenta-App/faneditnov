/**
 * Comprehensive test for Instagram, TikTok, and YouTube verification
 * Tests each platform and verifies data is stored in database
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { generateVerificationCode, normalizeProfileUrl } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const TIKTOK_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID;
const INSTAGRAM_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_INSTAGRAM_PROFILE_SCRAPER_ID;
const YOUTUBE_PROFILE_SCRAPER_ID = process.env.BRIGHT_DATA_YOUTUBE_PROFILE_SCRAPER_ID;

// Test accounts
const TEST_ACCOUNTS = {
  tiktok: 'https://www.tiktok.com/@zacy.ae',
  instagram: 'https://www.instagram.com/cristiano/',
  youtube: 'https://www.youtube.com/@MrBeast',
};

const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 10000; // 10 seconds

interface PlatformTestResult {
  platform: string;
  success: boolean;
  accountId?: string;
  snapshotId?: string;
  webhookReceived: boolean;
  hasProfileData: boolean;
  profileDataKeys?: string[];
  verificationStatus?: string;
  errors: string[];
  retries: number;
}

const results: Record<string, PlatformTestResult> = {};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

if (!BRIGHT_DATA_API_KEY) {
  console.error('❌ Missing BrightData API key');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function log(platform: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${platform}] ${message}`);
}

async function createTestUser() {
  const testEmail = `test-platforms-${Date.now()}@example.com`;
  
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (error) throw error;

  // Ensure profile exists
  await supabaseAdmin
    .from('profiles')
    .insert({
      id: newUser.user.id,
      email: testEmail,
      role: 'standard',
      email_verified: true,
    })
    .select()
    .single()
    .then(({ error }) => {
      if (error && !error.message.includes('duplicate')) throw error;
    });

  return newUser.user;
}

async function createSocialAccount(userId: string, platform: 'tiktok' | 'instagram' | 'youtube', url: string) {
  const normalizedUrl = normalizeProfileUrl(url);
  const verificationCode = generateVerificationCode();

  // Check if exists
  const { data: existing } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('profile_url', normalizedUrl)
    .maybeSingle();

  let account;
  if (existing) {
    const { data: updated } = await supabaseAdmin
      .from('social_accounts')
      .update({
        verification_code: verificationCode,
        verification_status: 'PENDING',
        webhook_status: null,
        snapshot_id: null,
        profile_data: null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    account = updated;
  } else {
    const { data: created } = await supabaseAdmin
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
    account = created;
  }

  return account;
}

async function triggerBrightData(platform: 'tiktok' | 'instagram' | 'youtube', url: string, accountId: string): Promise<string> {
  const datasetId = platform === 'tiktok' ? TIKTOK_PROFILE_SCRAPER_ID :
                    platform === 'instagram' ? INSTAGRAM_PROFILE_SCRAPER_ID :
                    YOUTUBE_PROFILE_SCRAPER_ID;

  if (!datasetId) {
    throw new Error(`Missing dataset ID for ${platform}`);
  }

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

  // Update account with snapshot_id
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

async function waitForWebhook(accountId: string, platform: string, maxWait: number = MAX_WAIT_TIME): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWait) {
    attempts++;
    
    const { data: account } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (account?.webhook_status === 'COMPLETED') {
      log(platform, `✅ Webhook completed after ${Math.floor((Date.now() - startTime) / 1000)}s`);
      return true;
    } else if (account?.webhook_status === 'FAILED') {
      log(platform, `❌ Webhook failed`);
      return false;
    }

    if (attempts % 6 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log(platform, `⏳ Still waiting... (${elapsed}s elapsed)`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  log(platform, `⏳ Timeout after ${maxWait / 1000}s`);
  return false;
}

async function checkDatabaseStorage(accountId: string, platform: string): Promise<boolean> {
  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (!account) {
    log(platform, '❌ Account not found in database');
    return false;
  }

  const hasProfileData = !!account.profile_data;
  const webhookCompleted = account.webhook_status === 'COMPLETED';
  
  log(platform, `Database check:`);
  log(platform, `  Has profile_data: ${hasProfileData ? '✅ YES' : '❌ NO'}`);
  log(platform, `  Webhook status: ${account.webhook_status || 'NULL'}`);
  log(platform, `  Snapshot ID: ${account.snapshot_id || 'NULL'}`);
  
  if (hasProfileData) {
    const profileData = account.profile_data as any;
    const keys = Object.keys(profileData);
    log(platform, `  Profile data keys: ${keys.slice(0, 10).join(', ')}... (${keys.length} total)`);
    
    // Platform-specific checks
    if (platform === 'youtube') {
      const hasDescription = !!(profileData.Description || profileData.description);
      log(platform, `  Has Description: ${hasDescription ? '✅ YES' : '❌ NO'}`);
    } else if (platform === 'instagram') {
      const hasBiography = !!(profileData.biography || profileData.bio);
      log(platform, `  Has biography: ${hasBiography ? '✅ YES' : '❌ NO'}`);
    } else if (platform === 'tiktok') {
      const hasBiography = !!(profileData.biography || profileData.signature);
      log(platform, `  Has biography: ${hasBiography ? '✅ YES' : '❌ NO'}`);
    }
  }

  return hasProfileData && webhookCompleted;
}

async function testPlatform(platform: 'tiktok' | 'instagram' | 'youtube', maxRetries: number = 2): Promise<PlatformTestResult> {
  const result: PlatformTestResult = {
    platform,
    success: false,
    webhookReceived: false,
    hasProfileData: false,
    errors: [],
    retries: 0,
  };

  log(platform, `\n${'='.repeat(60)}`);
  log(platform, `Testing ${platform.toUpperCase()} Verification`);
  log(platform, `${'='.repeat(60)}`);

  const url = TEST_ACCOUNTS[platform];
  log(platform, `Test URL: ${url}`);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      result.retries = attempt;
      log(platform, `\n🔄 Retry attempt ${attempt}/${maxRetries}`);
    }

    try {
      // Create test user (reuse for all platforms)
      const user = await createTestUser();
      log(platform, `✅ Test user: ${user.id}`);

      // Create account
      const account = await createSocialAccount(user.id, platform, url);
      result.accountId = account.id;
      log(platform, `✅ Account created: ${account.id}`);
      log(platform, `   Verification code: ${account.verification_code}`);

      // Trigger BrightData
      const snapshotId = await triggerBrightData(platform, url, account.id);
      result.snapshotId = snapshotId;
      log(platform, `✅ BrightData triggered, snapshot_id: ${snapshotId}`);

      // Wait for webhook
      const webhookReceived = await waitForWebhook(account.id, platform);
      result.webhookReceived = webhookReceived;

      // Check database
      const dataStored = await checkDatabaseStorage(account.id, platform);
      result.hasProfileData = dataStored;

      if (dataStored) {
        const { data: finalAccount } = await supabaseAdmin
          .from('social_accounts')
          .select('*')
          .eq('id', account.id)
          .single();

        result.verificationStatus = finalAccount?.verification_status;
        result.profileDataKeys = finalAccount?.profile_data ? Object.keys(finalAccount.profile_data) : [];
        result.success = true;
        log(platform, `\n✅ TEST PASSED: Data stored correctly!`);
        break;
      } else {
        log(platform, `\n⚠️  Data not stored properly, will retry...`);
        result.errors.push(`Attempt ${attempt + 1}: Data not stored in database`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(platform, `❌ Error: ${errorMsg}`);
      result.errors.push(`Attempt ${attempt + 1}: ${errorMsg}`);
      
      if (attempt < maxRetries) {
        log(platform, `Will retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
      }
    }
  }

  if (!result.success) {
    log(platform, `\n❌ TEST FAILED after ${result.retries + 1} attempts`);
  }

  return result;
}

async function main() {
  console.log('🚀 Starting Multi-Platform Verification Test\n');

  // Test each platform
  results.tiktok = await testPlatform('tiktok');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay between tests

  results.instagram = await testPlatform('instagram');
  await new Promise(resolve => setTimeout(resolve, 2000));

  results.youtube = await testPlatform('youtube');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  Object.values(results).forEach(result => {
    console.log(`\n${result.platform.toUpperCase()}:`);
    console.log(`  Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`  Webhook Received: ${result.webhookReceived ? '✅ YES' : '❌ NO'}`);
    console.log(`  Profile Data Stored: ${result.hasProfileData ? '✅ YES' : '❌ NO'}`);
    console.log(`  Verification Status: ${result.verificationStatus || 'N/A'}`);
    console.log(`  Retries: ${result.retries}`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join('; ')}`);
    }
  });

  // Save results
  const filename = `test-results-all-platforms-${Date.now()}.json`;
  const filepath = `scripts/${filename}`;
  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${filepath}`);

  // Exit code
  const allPassed = Object.values(results).every(r => r.success);
  if (!allPassed) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main();

