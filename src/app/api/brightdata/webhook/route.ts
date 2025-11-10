import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { downloadAndStoreImage, isSupabaseUrl } from '@/lib/image-storage';

export const runtime = 'nodejs';

// Server-side environment variables
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;
const BRIGHT_DATA_WEBHOOK_SECRET = process.env.BRIGHT_DATA_WEBHOOK_SECRET;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on 429 or 5xx errors
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

async function processImagesInPayload(payload: any[]): Promise<any[]> {
  console.log('Processing images in payload...');
  let processedCount = 0;
  let errorCount = 0;

  // Process images for each record
  for (const record of payload) {
    try {
      // Process video cover
      const coverUrl = record.preview_image || record.cover_url || record.thumbnail;
      if (coverUrl && !isSupabaseUrl(coverUrl)) {
        const videoId = record.post_id || record.id || record.video_id;
        if (videoId) {
          const result = await downloadAndStoreImage(coverUrl, 'video-cover', videoId);
          if (result.success && result.supabaseUrl) {
            // Update all possible cover field paths that the ingestion function checks
            if (record.preview_image) record.preview_image = result.supabaseUrl;
            if (record.cover_url) record.cover_url = result.supabaseUrl;
            if (record.thumbnail) record.thumbnail = result.supabaseUrl;
            processedCount++;
            console.log(`✓ Migrated video cover for ${videoId}`);
          } else {
            errorCount++;
            console.warn(`✗ Failed to migrate video cover for ${videoId}:`, result.error);
          }
        }
      }

      // Process creator avatar
      const avatarUrl = record.profile_avatar || record.profile?.avatar || record.author?.avatarLarger || record.author?.avatar?.url_list?.[0] || record.author?.avatar_url || record.author?.profile_pic_url || record.profile?.profile_pic_url || record.profile_pic_url;
      if (avatarUrl && !isSupabaseUrl(avatarUrl)) {
        const creatorId = record.profile_id || record.author?.id || record.profile?.id;
        if (creatorId) {
          const result = await downloadAndStoreImage(avatarUrl, 'creator-avatar', creatorId);
          if (result.success && result.supabaseUrl) {
            // Update all possible avatar field paths that the ingestion function checks
            if (record.profile_avatar) record.profile_avatar = result.supabaseUrl;
            if (record.profile?.avatar) record.profile.avatar = result.supabaseUrl;
            if (record.author?.avatarLarger) record.author.avatarLarger = result.supabaseUrl;
            if (record.author?.avatar_url) record.author.avatar_url = result.supabaseUrl;
            if (record.author?.profile_pic_url) record.author.profile_pic_url = result.supabaseUrl;
            if (record.profile?.profile_pic_url) record.profile.profile_pic_url = result.supabaseUrl;
            if (record.profile_pic_url) record.profile_pic_url = result.supabaseUrl;
            // Update nested avatar.url_list if it exists
            if (record.author?.avatar?.url_list && Array.isArray(record.author.avatar.url_list) && record.author.avatar.url_list.length > 0) {
              record.author.avatar.url_list[0] = result.supabaseUrl;
            }
            if (record.profile?.avatar?.url_list && Array.isArray(record.profile.avatar.url_list) && record.profile.avatar.url_list.length > 0) {
              record.profile.avatar.url_list[0] = result.supabaseUrl;
            }
            processedCount++;
            console.log(`✓ Migrated creator avatar for ${creatorId}`);
          } else {
            errorCount++;
            console.warn(`✗ Failed to migrate creator avatar for ${creatorId}:`, result.error);
          }
        }
      }

      // Process sound cover (if exists)
      const soundCoverUrl = record.music?.cover || record.music?.coverLarge;
      if (soundCoverUrl && !isSupabaseUrl(soundCoverUrl)) {
        const soundId = record.music?.id || record.music?.music_id;
        if (soundId) {
          const result = await downloadAndStoreImage(soundCoverUrl, 'sound-cover', soundId);
          if (result.success && result.supabaseUrl) {
            if (record.music?.cover) record.music.cover = result.supabaseUrl;
            if (record.music?.coverLarge) record.music.coverLarge = result.supabaseUrl;
            processedCount++;
            console.log(`✓ Migrated sound cover for ${soundId}`);
          } else {
            errorCount++;
            console.warn(`✗ Failed to migrate sound cover for ${soundId}:`, result.error);
          }
        }
      }
    } catch (error) {
      errorCount++;
      console.error('Error processing images for record:', error);
      // Continue with next record even if this one fails
    }
  }

  console.log(`Image processing complete: ${processedCount} images migrated, ${errorCount} errors`);
  return payload;
}

async function processWebhookData(snapshot_id: string, dataset_id: string, payload: any[]) {
  console.log('Processing webhook data for snapshot:', snapshot_id, 'with', payload.length, 'records');
  
  if (!supabaseAdmin) {
    console.error('Supabase admin client not available');
    return NextResponse.json(
      { error: 'Database connection not available' },
      { status: 500 }
    );
  }

  // Retrieve submission metadata (skip_validation flag)
  // Try by snapshot_id first, then by URL if not found
  let metadata: any = null;
  
  console.log('🔍 METADATA LOOKUP - Searching for snapshot_id:', snapshot_id);
  
  const { data: metadataBySnapshot, error: snapshotError } = await supabaseAdmin
    .from('submission_metadata')
    .select('skip_validation, video_urls, submitted_by')
    .eq('snapshot_id', snapshot_id)
    .single();
  
  if (snapshotError) {
    console.log('🔍 METADATA LOOKUP - Snapshot ID lookup error:', snapshotError.message);
  }
  
  if (metadataBySnapshot) {
    metadata = metadataBySnapshot;
    console.log('✅ METADATA LOOKUP - Found by snapshot_id:', {
      snapshot_id,
      skip_validation: metadataBySnapshot.skip_validation,
      url_count: metadataBySnapshot.video_urls?.length || 0
    });
  } else if (payload && payload.length > 0) {
    // Try to find by URL if snapshot_id doesn't match
    // For bulk uploads, try matching any URL in the payload
    const urlsToTry = payload
      .map((record: any) => record?.url || record?.input?.url)
      .filter((url: any) => url && typeof url === 'string')
      .slice(0, 5); // Try up to 5 URLs
    
    console.log('🔍 METADATA LOOKUP - Snapshot ID not found, trying to find by URLs:', urlsToTry);
    
    for (const url of urlsToTry) {
      if (!url) continue;
      
      // Try contains query (works for array columns in Postgres)
      const { data: metadataByUrl, error: urlError } = await supabaseAdmin
        .from('submission_metadata')
        .select('skip_validation, video_urls, submitted_by, snapshot_id')
        .contains('video_urls', [url])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (urlError) {
        console.log('🔍 METADATA LOOKUP - URL lookup error for', url, ':', urlError.message);
        continue;
      }
      
      if (metadataByUrl) {
        metadata = metadataByUrl;
        console.log('✅ METADATA LOOKUP - Found by URL:', {
          matched_url: url,
          snapshot_id: metadataByUrl.snapshot_id,
          skip_validation: metadataByUrl.skip_validation,
          url_count: metadataByUrl.video_urls?.length || 0
        });
        break;
      }
    }
    
    if (!metadata) {
      console.log('⚠️ METADATA LOOKUP - No metadata found for snapshot_id or any URLs');
      console.log('⚠️ METADATA LOOKUP - This might be a bulk upload that needs manual review');
    }
  }

  const skipValidation = metadata?.skip_validation ?? false;
  
  console.log('Processing with skip_validation:', skipValidation);

  // Process images before database ingestion
  console.log('Downloading and storing images in Supabase Storage...');
  const processedPayload = await processImagesInPayload(payload);
  console.log('Image processing complete, proceeding with database ingestion...');

  const { data, error } = await supabaseAdmin.rpc('ingest_brightdata_snapshot_v2', {
    p_snapshot_id: snapshot_id,
    p_dataset_id: dataset_id || '',
    p_payload: processedPayload,
    p_skip_validation: skipValidation
  });

  if (error) {
    console.error('RPC error:', error);
    
    await supabaseAdmin
      .from('bd_ingestions')
      .update({ 
        status: 'failed', 
        error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('snapshot_id', snapshot_id);

    return NextResponse.json(
      { 
        error: 'Failed to process data',
        details: error.message
      },
      { status: 502 }
    );
  }

  console.log('RPC successful:', data);

  // Update homepage cache stats after successful ingestion
  try {
    console.log('Updating homepage cache stats...');
    const { data: cacheUpdate, error: cacheError } = await supabaseAdmin.rpc('update_homepage_stats');
    if (cacheError) {
      console.warn('Failed to update homepage cache:', cacheError.message);
      // Don't fail the entire request if cache update fails
    } else {
      console.log('Homepage cache updated:', cacheUpdate);
    }
  } catch (cacheUpdateError) {
    console.warn('Error updating homepage cache:', cacheUpdateError);
    // Continue even if cache update fails
  }

  // Cleanup: Delete used metadata
  await supabaseAdmin
    .from('submission_metadata')
    .delete()
    .eq('snapshot_id', snapshot_id);

  return NextResponse.json({
    ok: true,
    snapshotId: snapshot_id,
    result: data
  });
}

export async function POST(request: NextRequest) {
  try {
    // Log incoming request for debugging
    console.log('🎯 WEBHOOK RECEIVED - Headers:', Object.fromEntries(request.headers.entries()));
    console.log('🎯 WEBHOOK - Request URL:', request.url);
    console.log('🎯 WEBHOOK - Timestamp:', new Date().toISOString());
    console.log('🎯 WEBHOOK - Method:', request.method);
    console.log('🎯 WEBHOOK - Content-Type:', request.headers.get('content-type'));
    
    // BrightData doesn't use webhook secrets by default
    // We'll log and accept all requests from BrightData
    // Optional: Implement custom validation based on source IP or other methods
    
    // Handle empty body gracefully
    let body;
    let text: string | null = null;
    try {
      text = await request.text();
      console.log('🎯 WEBHOOK - Raw body length:', text.length);
      if (!text || text.trim().length === 0) {
        console.warn('🎯 WEBHOOK - Empty body received');
        return NextResponse.json({ error: 'Empty body' }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('🎯 WEBHOOK - JSON parse error:', parseError);
      console.error('🎯 WEBHOOK - Raw body (first 500 chars):', text?.substring(0, 500) || 'N/A');
      return NextResponse.json(
        { error: 'Invalid JSON', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 400 }
      );
    }
    console.log('🎯 WEBHOOK - Payload type:', Array.isArray(body) ? 'Array' : typeof body);
    console.log('🎯 WEBHOOK - Payload length/keys:', Array.isArray(body) ? body.length : Object.keys(body));
    
    // Log first few records for debugging
    if (Array.isArray(body) && body.length > 0) {
      console.log('🎯 WEBHOOK - First record preview:', JSON.stringify(body[0], null, 2).substring(0, 500));
      // Check for snapshot_id in first record
      const firstRecordSnapshotId = body[0]?.snapshot_id || body[0]?.snapshotId || body[0]?.input?.snapshot_id;
      if (firstRecordSnapshotId) {
        console.log('🎯 WEBHOOK - Found snapshot_id in payload:', firstRecordSnapshotId);
      }
    } else {
      console.log('🎯 WEBHOOK - Full payload:', JSON.stringify(body, null, 2).substring(0, 1000));
    }
    
    // BrightData can send webhooks in two formats:
    // 1. Status notification with response_id pointing to snapshot
    // 2. Direct data payload (with uncompressed_webhook=true)
    
    // Check if this is data payload (array of records)
    if (Array.isArray(body) && body.length > 0) {
      console.log('Received data payload directly, extracting snapshot from first record...');
      // Extract snapshot_id from various possible locations in BrightData payload
      let snapshot_id = body[0]?.snapshot_id 
        || body[0]?.snapshotId 
        || body[0]?.input?.snapshot_id
        || body[0]?.metadata?.snapshot_id
        || body[0]?._snapshot_id;
      
      // Also check if snapshot_id is in the request headers or query params
      if (!snapshot_id) {
        const headerSnapshotId = request.headers.get('x-snapshot-id') || request.headers.get('snapshot-id');
        if (headerSnapshotId) {
          snapshot_id = headerSnapshotId;
          console.log('Found snapshot_id in headers:', snapshot_id);
        }
      }
      
      // If still no snapshot_id, try to find it by matching URLs in metadata
      if (!snapshot_id && supabaseAdmin) {
        const firstUrl = body[0]?.url || body[0]?.input?.url;
        if (firstUrl) {
          console.log('No snapshot_id found, trying to match by URL:', firstUrl);
          const { data: metadataByUrl } = await supabaseAdmin
            .from('submission_metadata')
            .select('snapshot_id')
            .contains('video_urls', [firstUrl])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (metadataByUrl?.snapshot_id) {
            snapshot_id = metadataByUrl.snapshot_id;
            console.log('Found snapshot_id by URL match:', snapshot_id);
          }
        }
      }
      
      // If no snapshot_id found, generate one from timestamp (should not happen in production)
      if (!snapshot_id) {
        snapshot_id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.warn('⚠️ No snapshot_id in data payload, generated one:', snapshot_id);
        console.warn('⚠️ This may indicate a configuration issue with BrightData webhook');
      }
      
      // Process the data payload directly
      return await processWebhookData(snapshot_id, '', body);
    }
    
    // If we got here, this is a notification webhook with snapshot_id
    // Extract snapshot_id and download the data from BrightData API
    let snapshot_id = body.snapshot_id || body.snapshotId || body.response_id || body.request_id;
    let dataset_id = body.dataset_id || body.datasetId || '';
    
    if (!snapshot_id) {
      console.error('Unable to extract snapshot_id from payload:', body);
      return NextResponse.json(
        { error: 'snapshot_id is required', received_payload: body },
        { status: 400 }
      );
    }
    
    // Check if this is just a notification webhook (no data payload)
    // When using uncompressed_webhook=true, BrightData sends:
    // 1. Notification webhook: {snapshot_id, status: "ready"} 
    // 2. Data webhook: [array of records]
    // We should acknowledge notification webhooks but wait for the data webhook
    const isNotificationOnly = body.status && !Array.isArray(body) && !body.data && Object.keys(body).length <= 3;
    
    if (isNotificationOnly) {
      console.log('Received notification-only webhook (no data), acknowledging and waiting for data webhook...', { 
        snapshot_id, 
        status: body.status 
      });
      
      // Check if we've already processed this snapshot (data webhook may have arrived first)
      if (supabaseAdmin) {
        const { data: existingIngestion } = await supabaseAdmin
          .from('bd_ingestions')
          .select('status')
          .eq('snapshot_id', snapshot_id)
          .maybeSingle();
        
        if (existingIngestion?.status === 'completed') {
          console.log(`Snapshot ${snapshot_id} already processed, skipping notification`);
          return NextResponse.json({
            message: 'Snapshot already processed',
            snapshot_id: snapshot_id,
            status: existingIngestion.status,
            skipped: true
          });
        }
      }
      
      // Acknowledge the notification - the actual data will come in a separate webhook
      return NextResponse.json({
        message: 'Notification received, waiting for data webhook',
        snapshot_id: snapshot_id,
        status: body.status
      });
    }
    
    console.log('Received notification webhook, downloading data from BrightData...', { snapshot_id, status: body.status });
    
    // Check if we've already processed this snapshot
    if (supabaseAdmin) {
      const { data: existingIngestion } = await supabaseAdmin
        .from('bd_ingestions')
        .select('status')
        .eq('snapshot_id', snapshot_id)
        .maybeSingle();
      
      if (existingIngestion?.status === 'completed') {
        console.log(`Snapshot ${snapshot_id} already processed, skipping`);
        return NextResponse.json({
          message: 'Snapshot already processed',
          snapshot_id: snapshot_id,
          status: existingIngestion.status,
          skipped: true
        });
      }
    }
    
    // For notification webhooks with status 'ready' or 'done', we still need to download the data
    // BrightData sends notification webhooks separately from data webhooks, so we should always try to download
    if (body.status === 'ready' || body.status === 'done') {
      console.log(`Notification webhook indicates status "${body.status}" - proceeding to download data from API`);
    }
    
    // First check snapshot status - wait for it to be ready
    console.log('Checking snapshot status...');
    let snapshotReady = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!snapshotReady && attempts < maxAttempts) {
      try {
        const snapshotResponse = await fetchWithRetry(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
            },
          }
        );

        if (!snapshotResponse.ok) {
          console.error(`Snapshot API returned ${snapshotResponse.status}`);
          if (attempts < maxAttempts) {
            attempts++;
            await sleep(2000);
            continue;
          }
          break;
        }

        const snapshotData = await snapshotResponse.json();
        console.log('Snapshot status:', snapshotData.status);

        if (snapshotData.status === 'ready') {
          snapshotReady = true;
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Snapshot not ready, waiting 2s (attempt ${attempts}/${maxAttempts})`);
            await sleep(2000);
          }
        }
      } catch (error) {
        console.error('Error checking snapshot status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(2000);
        }
      }
    }

    if (!snapshotReady) {
      console.error('Snapshot not ready after maximum attempts, attempting to proceed anyway...');
      // Continue to try download - sometimes status check fails but data is available
    }
    
    // Download snapshot data from BrightData
    console.log('Downloading snapshot data from BrightData...');
    const dataResponse = await fetchWithRetry(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}/data`,
      {
        headers: {
          'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
        },
      },
      2
    );

    if (!dataResponse.ok) {
      const errorText = await dataResponse.text();
      console.error('Data download failed:', dataResponse.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to download snapshot data',
          details: `API returned ${dataResponse.status}: ${errorText}`
        },
        { status: 500 }
      );
    }

    const payload = await dataResponse.json();
    console.log('Data downloaded, processing...', { recordCount: Array.isArray(payload) ? payload.length : 'unknown' });
    
    // Process the downloaded data
    return await processWebhookData(snapshot_id, dataset_id, payload);
    
    // OLD CODE BELOW - polling removed, keeping for reference
    /*
    // Otherwise, treat as status notification or metadata
    // Try to extract snapshot_id from various possible fields
    let snapshot_id = body.snapshot_id || body.snapshotId || body.response_id || body.request_id;
    let dataset_id = body.dataset_id || body.datasetId;
    
    // If snapshot_id is in a nested structure, check common patterns
    if (!snapshot_id && body.data) {
      snapshot_id = body.data.snapshot_id || body.data.snapshotId;
    }
    
    if (!snapshot_id && body.response) {
      snapshot_id = body.response.snapshot_id || body.response.snapshotId;
    }

    if (!snapshot_id) {
      console.error('Unable to extract snapshot_id from payload:', body);
      return NextResponse.json(
        { error: 'snapshot_id is required', received_payload: body },
        { status: 400 }
      );
    }

    // Progress guard: check snapshot status
    let snapshotReady = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!snapshotReady && attempts < maxAttempts) {
      try {
        const snapshotResponse = await fetchWithRetry(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
            },
          }
        );

        if (!snapshotResponse.ok) {
          throw new Error(`Snapshot API returned ${snapshotResponse.status}`);
        }

        const snapshotData = await snapshotResponse.json();
        console.log('Snapshot status:', snapshotData.status);

        if (snapshotData.status === 'ready') {
          snapshotReady = true;
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Snapshot not ready, waiting 2s (attempt ${attempts}/${maxAttempts})`);
            await sleep(2000);
          }
        }
      } catch (error) {
        console.error('Error checking snapshot status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(2000);
        }
      }
    }

    if (!snapshotReady) {
      console.error('Snapshot not ready after maximum attempts, attempting to proceed anyway...');
      // Don't fail - try to download data anyway
    }

    // Download snapshot data
    console.log('Downloading snapshot data...');
    const dataResponse = await fetchWithRetry(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}/data`,
      {
        headers: {
          'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
        },
      },
      2 // Max 2 retries for data download
    );

    if (!dataResponse.ok) {
      const errorText = await dataResponse.text();
      console.error('Data download failed:', dataResponse.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to download snapshot data',
          details: `API returned ${dataResponse.status}: ${errorText}`
        },
        { status: 500 }
      );
    }

    const payload = await dataResponse.json();
    console.log('Data downloaded, processing...', { recordCount: Array.isArray(payload) ? payload.length : 'unknown' });

    // Call Supabase function to ingest data
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc('ingest_brightdata_snapshot_v2', {
      p_snapshot_id: snapshot_id,
      p_dataset_id: dataset_id || '',
      p_payload: payload
    });

    if (error) {
      console.error('RPC error:', error);
      
      // Update ingestion record with error
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('bd_ingestions')
          .update({ 
            status: 'failed', 
            error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('snapshot_id', snapshot_id);
      }

      return NextResponse.json(
        { 
          error: 'Failed to process data',
          details: error.message
        },
        { status: 502 }
      );
    }

    console.log('RPC successful:', data);

    return NextResponse.json({
      ok: true,
      snapshotId: snapshot_id,
      result: data
    });

    */
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'BrightData Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}

// Handle OPTIONS for CORS (BrightData may check this)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
