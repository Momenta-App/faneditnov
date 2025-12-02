/**
 * Manually process pending webhooks by polling BrightData
 * Use this when webhooks don't arrive automatically
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { extractBioFromProfileData, verifyCodeInBio } from '../src/lib/social-account-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function pollBrightDataSnapshot(snapshotId: string): Promise<any> {
  console.log(`Polling BrightData snapshot: ${snapshotId}`);
  
  const maxAttempts = 30; // 5 minutes max
  const pollInterval = 10000; // 10 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check status
      const statusResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase();
      
      // Check if data is directly in status response
      if (statusData.url || statusData.handle || statusData.Description || statusData.biography) {
        console.log(`✅ Data found directly in status response`);
        return statusData;
      }

      if (status === 'ready' || status === 'completed' || status === 'done') {
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
          console.log(`✅ Data downloaded successfully`);
          return profileData;
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Snapshot failed: ${status}`);
      }

      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Timeout waiting for snapshot');
}

async function processAccount(account: any) {
  console.log(`\nProcessing account: ${account.id}`);
  console.log(`  Platform: ${account.platform}`);
  console.log(`  URL: ${account.profile_url}`);
  console.log(`  Snapshot ID: ${account.snapshot_id}`);
  console.log(`  Verification Code: ${account.verification_code}`);

  if (!account.snapshot_id) {
    console.log(`  ⚠️  No snapshot_id, skipping`);
    return false;
  }

  try {
    // Poll BrightData for data
    const profileData = await pollBrightDataSnapshot(account.snapshot_id);
    
    // Extract bio and verify code
    const bioText = extractBioFromProfileData(profileData, account.platform);
    const codeFound = verifyCodeInBio(bioText, account.verification_code);

    console.log(`  Bio text: "${bioText.substring(0, 100)}${bioText.length > 100 ? '...' : ''}"`);
    console.log(`  Code found: ${codeFound ? '✅ YES' : '❌ NO'}`);

    // Update account
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
      console.error(`  ❌ Error updating: ${updateError.message}`);
      return false;
    }

    console.log(`  ✅ Account updated successfully`);
    console.log(`  ✅ Verification status: ${updateData.verification_status}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Finding pending accounts...\n');

  // Get all pending accounts with snapshot_id
  const { data: pendingAccounts, error } = await supabaseAdmin
    .from('social_accounts')
    .select('*')
    .not('snapshot_id', 'is', null)
    .or('webhook_status.eq.PENDING,webhook_status.is.null')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    process.exit(1);
  }

  if (!pendingAccounts || pendingAccounts.length === 0) {
    console.log('✅ No pending accounts found');
    return;
  }

  console.log(`Found ${pendingAccounts.length} pending account(s)\n`);

  // Process each account
  let successCount = 0;
  for (const account of pendingAccounts) {
    const success = await processAccount(account);
    if (success) successCount++;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay between accounts
  }

  console.log(`\n📊 Processed ${pendingAccounts.length} account(s), ${successCount} successful`);
}

main();

