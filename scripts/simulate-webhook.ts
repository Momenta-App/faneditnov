/**
 * Simulate BrightData webhook to test snapshot_id extraction
 */

// Simulate different webhook formats BrightData might send
const webhookFormats = [
  // Format 1: Direct data with input field (most common with uncompressed_webhook=true)
  {
    name: 'Format 1: Direct data with input.snapshot_id',
    payload: [{
      url: 'https://www.youtube.com/@mrbeast',
      handle: '@MrBeast',
      Description: 'SUBSCRIBE FOR A COOKIE!',
      name: 'MrBeast',
      input: {
        snapshot_id: 'sd_mio854n92ekrrl50z0',
        url: 'https://www.youtube.com/@MrBeast/about'
      }
    }]
  },
  // Format 2: Wrapper with snapshot_id at top level
  {
    name: 'Format 2: Wrapper with snapshot_id',
    payload: [{
      snapshot_id: 'sd_mio854n92ekrrl50z0',
      status: 'completed',
      data: {
        url: 'https://www.youtube.com/@mrbeast',
        handle: '@MrBeast',
        Description: 'SUBSCRIBE FOR A COOKIE!'
      }
    }]
  },
  // Format 3: Notification format
  {
    name: 'Format 3: Notification format',
    payload: {
      snapshot_id: 'sd_mio854n92ekrrl50z0',
      status: 'ready'
    }
  },
  // Format 4: Direct object with snapshot_id
  {
    name: 'Format 4: Direct object',
    payload: {
      snapshot_id: 'sd_mio854n92ekrrl50z0',
      url: 'https://www.youtube.com/@mrbeast',
      handle: '@MrBeast',
      Description: 'SUBSCRIBE FOR A COOKIE!'
    }
  }
];

function extractSnapshotId(payload: any): string | undefined {
  let snapshot_id: string | undefined;
  
  // Check headers (simulated)
  // snapshot_id = request.headers.get('x-snapshot-id');
  
  // Check if array
  if (Array.isArray(payload) && payload.length > 0) {
    const firstItem = payload[0];
    snapshot_id = 
      firstItem.snapshot_id || 
      firstItem.id || 
      firstItem.snapshotId || 
      firstItem.collection_id ||
      firstItem.input?.snapshot_id ||
      firstItem.input?.id ||
      firstItem.metadata?.snapshot_id ||
      firstItem._snapshot_id;
  } else if (payload && typeof payload === 'object') {
    snapshot_id =
      payload.snapshot_id || 
      payload.id || 
      payload.snapshotId || 
      payload.snapshot || 
      payload.collection_id ||
      payload.input?.snapshot_id ||
      payload.input?.id ||
      payload.metadata?.snapshot_id;
  }
  
  // Final check: if we have profile data with input field
  const profileData = Array.isArray(payload) ? payload[0] : payload;
  if (!snapshot_id && profileData?.input) {
    snapshot_id = profileData.input.snapshot_id || profileData.input.id;
  }
  
  return snapshot_id;
}

console.log('Testing snapshot_id extraction from different webhook formats:\n');

webhookFormats.forEach((format, index) => {
  console.log(`${index + 1}. ${format.name}`);
  const extracted = extractSnapshotId(format.payload);
  console.log(`   Extracted snapshot_id: ${extracted || '❌ NOT FOUND'}`);
  console.log(`   Expected: sd_mio854n92ekrrl50z0`);
  console.log(`   Match: ${extracted === 'sd_mio854n92ekrrl50z0' ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

