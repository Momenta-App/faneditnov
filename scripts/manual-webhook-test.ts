/**
 * Manually test webhook processing by polling BrightData and simulating webhook
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;

const TEST_SNAPSHOT_ID = 'sd_mio854n92ekrrl50z0'; // From the test we just ran
const TEST_ACCOUNT_ID = '1126843d-0de6-48ea-ada2-72e8671ddaee';

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkSnapshot() {
  console.log(`Checking BrightData snapshot: ${TEST_SNAPSHOT_ID}\n`);
  
  // Check snapshot status
  const statusResponse = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${TEST_SNAPSHOT_ID}`,
    {
      headers: {
        'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
      },
    }
  );

  if (!statusResponse.ok) {
    const errorText = await statusResponse.text();
    console.error(`❌ Status check failed: ${statusResponse.status} - ${errorText}`);
    return;
  }

  const statusData = await statusResponse.json();
  const status = statusData.status?.toLowerCase() || statusData.state?.toLowerCase();
  
  console.log(`Snapshot Status: ${status}`);
  console.log(`Full status response:`, JSON.stringify(statusData, null, 2));
  console.log('');

  if (status === 'ready' || status === 'completed' || status === 'done') {
    console.log('✅ Snapshot is ready, downloading data...\n');
    
    // Download data
    const dataResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${TEST_SNAPSHOT_ID}/data`,
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
      
      console.log('✅ Data downloaded successfully!');
      console.log(`Data keys: ${Object.keys(profileData).slice(0, 15).join(', ')}`);
      console.log(`\nSample data:`, JSON.stringify(profileData, null, 2).substring(0, 1000));
      console.log('\n');
      
      // Check account
      const { data: account } = await supabaseAdmin
        .from('social_accounts')
        .select('*')
        .eq('id', TEST_ACCOUNT_ID)
        .single();
      
      if (account) {
        console.log(`Account found:`);
        console.log(`  URL: ${account.profile_url}`);
        console.log(`  Snapshot ID: ${account.snapshot_id}`);
        console.log(`  Webhook Status: ${account.webhook_status || 'NULL'}`);
        console.log(`  Verification Code: ${account.verification_code}`);
        
        // Extract URL from profile data
        const profileUrl = profileData.url || profileData.profile_url || profileData.account_url;
        console.log(`\nProfile data URL: ${profileUrl}`);
        console.log(`Account URL: ${account.profile_url}`);
        console.log(`URLs match: ${profileUrl === account.profile_url || profileUrl?.replace('/about', '') === account.profile_url}`);
        
        // Check if webhook would find this account
        console.log(`\n🔍 Testing account lookup logic...`);
        
        // Try snapshot_id lookup
        const { data: accountBySnapshot } = await supabaseAdmin
          .from('social_accounts')
          .select('*')
          .eq('snapshot_id', TEST_SNAPSHOT_ID)
          .maybeSingle();
        
        console.log(`  By snapshot_id: ${accountBySnapshot ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        // Try URL lookup
        if (profileUrl) {
          const normalizedUrl = profileUrl.replace('/about', '').replace(/\/$/, '');
          const { data: accountByUrl } = await supabaseAdmin
            .from('social_accounts')
            .select('*')
            .eq('profile_url', normalizedUrl)
            .maybeSingle();
          
          console.log(`  By URL (${normalizedUrl}): ${accountByUrl ? '✅ FOUND' : '❌ NOT FOUND'}`);
          
          // Try with www variations
          const urlVariations = [
            profileUrl,
            normalizedUrl,
            profileUrl.replace('www.', ''),
            profileUrl.replace('youtube.com', 'www.youtube.com'),
          ];
          
          for (const urlVar of urlVariations) {
            const { data: accountByVar } = await supabaseAdmin
              .from('social_accounts')
              .select('*')
              .eq('profile_url', urlVar)
              .maybeSingle();
            
            if (accountByVar) {
              console.log(`  By URL variation (${urlVar}): ✅ FOUND`);
            }
          }
        }
      }
    } else {
      const errorText = await dataResponse.text();
      console.error(`❌ Data download failed: ${dataResponse.status} - ${errorText}`);
    }
  } else {
    console.log(`⏳ Snapshot status: ${status} (not ready yet)`);
  }
}

checkSnapshot();

