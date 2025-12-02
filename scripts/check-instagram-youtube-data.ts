/**
 * Check database for Instagram and YouTube profile data
 * Verifies what data we have stored
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { extractBioFromProfileData } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkStoredData() {
  console.log('🔍 Checking stored profile data in database...\n');

  // Check Instagram accounts
  console.log('📸 Instagram Accounts:');
  const { data: instagramAccounts } = await supabaseAdmin
    .from('social_accounts')
    .select('id, profile_url, username, profile_data, snapshot_id, webhook_status, verification_status')
    .eq('platform', 'instagram')
    .order('created_at', { ascending: false })
    .limit(5);

  if (instagramAccounts && instagramAccounts.length > 0) {
    instagramAccounts.forEach((account, idx) => {
      console.log(`\n   ${idx + 1}. ${account.profile_url}`);
      console.log(`      Username: ${account.username || 'N/A'}`);
      console.log(`      Snapshot ID: ${account.snapshot_id || 'N/A'}`);
      console.log(`      Webhook Status: ${account.webhook_status || 'N/A'}`);
      console.log(`      Verification Status: ${account.verification_status || 'N/A'}`);
      
      if (account.profile_data) {
        const profileData = account.profile_data as any;
        const bio = extractBioFromProfileData(profileData, 'instagram');
        console.log(`      ✅ Profile data: PRESENT (${Object.keys(profileData).length} fields)`);
        console.log(`      Bio: "${bio.substring(0, 100)}${bio.length > 100 ? '...' : ''}"`);
      } else {
        console.log(`      ❌ Profile data: MISSING`);
      }
    });
  } else {
    console.log('   No Instagram accounts found');
  }

  // Check YouTube accounts
  console.log('\n📺 YouTube Accounts:');
  const { data: youtubeAccounts } = await supabaseAdmin
    .from('social_accounts')
    .select('id, profile_url, username, profile_data, snapshot_id, webhook_status, verification_status')
    .eq('platform', 'youtube')
    .order('created_at', { ascending: false })
    .limit(5);

  if (youtubeAccounts && youtubeAccounts.length > 0) {
    youtubeAccounts.forEach((account, idx) => {
      console.log(`\n   ${idx + 1}. ${account.profile_url}`);
      console.log(`      Username: ${account.username || 'N/A'}`);
      console.log(`      Snapshot ID: ${account.snapshot_id || 'N/A'}`);
      console.log(`      Webhook Status: ${account.webhook_status || 'N/A'}`);
      console.log(`      Verification Status: ${account.verification_status || 'N/A'}`);
      
      if (account.profile_data) {
        const profileData = account.profile_data as any;
        const bio = extractBioFromProfileData(profileData, 'youtube');
        console.log(`      ✅ Profile data: PRESENT (${Object.keys(profileData).length} fields)`);
        console.log(`      Bio: "${bio.substring(0, 100)}${bio.length > 100 ? '...' : ''}"`);
      } else {
        console.log(`      ❌ Profile data: MISSING`);
      }
    });
  } else {
    console.log('   No YouTube accounts found');
  }

  // Summary
  console.log('\n📊 Summary:');
  const { data: allAccounts } = await supabaseAdmin
    .from('social_accounts')
    .select('platform, profile_data, webhook_status')
    .not('profile_data', 'is', null);

  const withData = allAccounts?.filter(a => a.profile_data) || [];
  const instagramWithData = withData.filter(a => a.platform === 'instagram').length;
  const youtubeWithData = withData.filter(a => a.platform === 'youtube').length;
  const tiktokWithData = withData.filter(a => a.platform === 'tiktok').length;

  console.log(`   Instagram accounts with profile_data: ${instagramWithData}`);
  console.log(`   YouTube accounts with profile_data: ${youtubeWithData}`);
  console.log(`   TikTok accounts with profile_data: ${tiktokWithData}`);
  console.log(`   Total accounts with profile_data: ${withData.length}`);
}

checkStoredData().catch(console.error);

