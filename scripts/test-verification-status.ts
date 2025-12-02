/**
 * Test script for verification status endpoint
 * Tests the BrightData polling logic
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
const TEST_SNAPSHOT_ID = process.env.TEST_SNAPSHOT_ID || '';

async function testBrightDataPolling() {
  if (!BRIGHT_DATA_API_KEY) {
    console.error('❌ BRIGHT_DATA_API_KEY not configured');
    process.exit(1);
  }

  if (!TEST_SNAPSHOT_ID) {
    console.log('ℹ️  TEST_SNAPSHOT_ID not set, using a test snapshot check...');
    console.log('   Set TEST_SNAPSHOT_ID in .env.local to test with a real snapshot');
    return;
  }

  console.log('🧪 Testing BrightData snapshot polling...');
  console.log(`   Snapshot ID: ${TEST_SNAPSHOT_ID}`);
  console.log('');

  try {
    // Step 1: Check snapshot status
    console.log('1️⃣  Checking snapshot status...');
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
    console.log(`   Status: ${status}`);
    console.log(`   Full response:`, JSON.stringify(statusData, null, 2));
    console.log('');

    // Step 2: If ready, download data
    if (status === 'ready' || status === 'completed' || status === 'done' || status === 'success') {
      console.log('2️⃣  Snapshot ready, downloading data...');
      const dataResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${TEST_SNAPSHOT_ID}/data`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error(`❌ Data download failed: ${dataResponse.status} - ${errorText}`);
        return;
      }

      const dataPayload = await dataResponse.json();
      const profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
        ? dataPayload[0] 
        : dataPayload;

      console.log('✅ Data downloaded successfully!');
      console.log(`   Profile data keys:`, Object.keys(profileData).slice(0, 10));
      
      // Check for bio fields
      const bioFields = ['biography', 'bio', 'Description', 'description', 'signature', 'about'];
      const foundBioFields = bioFields.filter(field => profileData[field]);
      console.log(`   Bio fields found:`, foundBioFields);
      
      if (foundBioFields.length > 0) {
        const bioField = foundBioFields[0];
        const bioText = profileData[bioField];
        console.log(`   Bio text (${bioField}):`, bioText?.substring(0, 100) + (bioText?.length > 100 ? '...' : ''));
      }

      console.log('');
      console.log('✅ Test completed successfully!');
    } else {
      console.log(`ℹ️  Snapshot not ready yet (status: ${status})`);
      console.log('   This is normal if the snapshot is still processing');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Test the API endpoint structure
async function testEndpointStructure() {
  console.log('🧪 Testing API endpoint structure...');
  console.log('');

  const testCases = [
    {
      name: 'Status endpoint URL',
      url: '/api/settings/connected-accounts/verify/status?account_id=test',
      method: 'GET',
    },
    {
      name: 'Verify endpoint URL',
      url: '/api/settings/connected-accounts/verify',
      method: 'POST',
    },
    {
      name: 'Profile webhook URL',
      url: '/api/brightdata/profile-webhook',
      method: 'POST',
    },
  ];

  console.log('📋 Endpoint structure:');
  testCases.forEach(test => {
    console.log(`   ${test.method} ${test.url}`);
  });
  console.log('');

  // Check if files exist
  const fs = await import('fs');
  const path = await import('path');
  
  const files = [
    'src/app/api/settings/connected-accounts/verify/status/route.ts',
    'src/app/api/settings/connected-accounts/verify/route.ts',
    'src/app/api/brightdata/profile-webhook/route.ts',
  ];

  console.log('📁 Checking files exist:');
  files.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  });
  console.log('');
}

async function main() {
  console.log('🚀 Verification Status Test Suite');
  console.log('================================\n');

  await testEndpointStructure();
  
  if (TEST_SNAPSHOT_ID) {
    await testBrightDataPolling();
  } else {
    console.log('💡 To test BrightData polling:');
    console.log('   1. Trigger a verification in the app');
    console.log('   2. Get the snapshot_id from the database');
    console.log('   3. Set TEST_SNAPSHOT_ID=<snapshot_id> in .env.local');
    console.log('   4. Run this script again');
  }
}

main().catch(console.error);

