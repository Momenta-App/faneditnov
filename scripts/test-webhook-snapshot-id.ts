/**
 * Test webhook snapshot_id extraction
 * Simulates what BrightData sends and tests extraction logic
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_SNAPSHOT_ID = 'sd_mio854n92ekrrl50z0'; // From our test

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testSnapshotIdLookup() {
  console.log('Testing snapshot_id lookup...\n');
  console.log(`Looking for snapshot_id: ${TEST_SNAPSHOT_ID}\n`);
  
  // Test 1: Direct lookup
  const { data: account1, error: error1 } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('snapshot_id', TEST_SNAPSHOT_ID)
    .maybeSingle();
  
  console.log('Test 1: Direct eq() lookup');
  console.log(`  Found: ${account1 ? '✅ YES' : '❌ NO'}`);
  console.log(`  Account ID: ${account1?.id || 'N/A'}`);
  console.log(`  Profile URL: ${account1?.profile_url || 'N/A'}`);
  console.log(`  Error: ${error1?.message || 'None'}\n`);
  
  // Test 2: Check if snapshot_id exists at all
  const { data: allAccounts } = await supabaseAdmin
    .from('social_accounts')
    .select('id, snapshot_id, profile_url, webhook_status')
    .not('snapshot_id', 'is', null)
    .limit(10);
  
  console.log('Test 2: Accounts with snapshot_id:');
  allAccounts?.forEach(acc => {
    console.log(`  - ${acc.id}: snapshot_id="${acc.snapshot_id}", url="${acc.profile_url}", status="${acc.webhook_status || 'NULL'}"`);
  });
  console.log('');
  
  // Test 3: Check if our test snapshot_id exists
  const hasSnapshotId = allAccounts?.some(a => a.snapshot_id === TEST_SNAPSHOT_ID);
  console.log(`Test 3: Does snapshot_id "${TEST_SNAPSHOT_ID}" exist in database?`);
  console.log(`  ${hasSnapshotId ? '✅ YES' : '❌ NO'}\n`);
  
  // Test 4: Check account by ID from our test
  const TEST_ACCOUNT_ID = '1126843d-0de6-48ea-ada2-72e8671ddaee';
  const { data: testAccount } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .eq('id', TEST_ACCOUNT_ID)
    .single();
  
  if (testAccount) {
    console.log('Test 4: Test account details:');
    console.log(`  ID: ${testAccount.id}`);
    console.log(`  Snapshot ID: ${testAccount.snapshot_id || 'NULL'}`);
    console.log(`  Profile URL: ${testAccount.profile_url}`);
    console.log(`  Webhook Status: ${testAccount.webhook_status || 'NULL'}`);
    console.log(`  Verification Status: ${testAccount.verification_status}`);
    console.log(`  Snapshot ID matches test: ${testAccount.snapshot_id === TEST_SNAPSHOT_ID ? '✅ YES' : '❌ NO'}\n`);
  }
}

testSnapshotIdLookup();

