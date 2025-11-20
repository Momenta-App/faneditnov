#!/usr/bin/env tsx

/**
 * Test API endpoints to check for errors
 */

async function testAPI() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log(`Testing API at: ${baseUrl}\n`);
  
  // Test homepage API
  try {
    console.log('Testing /api/homepage...');
    const response = await fetch(`${baseUrl}/api/homepage?timeRange=all`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${data.success}`);
    if (data.error) {
      console.log(`Error: ${data.error}`);
    }
    if (data.data) {
      console.log(`Has stats: ${!!data.data.stats}`);
      console.log(`Has videos: ${Array.isArray(data.data.topVideos)}`);
    }
  } catch (error) {
    console.error('❌ Homepage API failed:', error);
  }
  
  // Test videos API
  try {
    console.log('\nTesting /api/videos...');
    const response = await fetch(`${baseUrl}/api/videos?limit=5`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    if (data.data) {
      console.log(`Videos returned: ${data.data.length}`);
    } else if (data.error) {
      console.log(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Videos API failed:', error);
  }
}

testAPI().catch(console.error);

