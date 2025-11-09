import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot_id, dataset_id, bypass_auth } = body;

    if (!snapshot_id) {
      return NextResponse.json(
        { error: 'snapshot_id is required' },
        { status: 400 }
      );
    }

    // Allow bypassing auth for testing (only in development)
    if (!bypass_auth && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication required in production' },
        { status: 403 }
      );
    }

    console.log('Manual webhook trigger received:', { snapshot_id, dataset_id });

    // Check snapshot status (but proceed even if not ready - data might be available)
    let snapshotReady = false;
    let attempts = 0;
    const maxAttempts = 10; // More attempts for manual testing

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
          console.warn(`Snapshot API returned ${snapshotResponse.status}`);
          if (attempts < maxAttempts - 1) {
            attempts++;
            await sleep(3000);
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
            console.log(`Snapshot not ready (status: ${snapshotData.status}), waiting 3s (attempt ${attempts}/${maxAttempts})`);
            await sleep(3000);
          }
        }
      } catch (error) {
        console.error('Error checking snapshot status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(3000);
        }
      }
    }

    if (!snapshotReady) {
      console.warn('Snapshot not ready after maximum attempts, attempting to download anyway (data might still be available)');
    }

    // Try to get snapshot status (it might contain the data itself)
    console.log('Fetching snapshot status...');
    let snapshotStatusData = null;
    try {
      const statusResponse = await fetchWithRetry(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );
      
      if (statusResponse.ok) {
        snapshotStatusData = await statusResponse.json();
        // If the snapshot status contains data fields (like 'url', 'post_id'), it's the actual data
        // We'll use it as fallback if /data endpoint fails
        if (snapshotStatusData.url || snapshotStatusData.post_id) {
          console.log('Found data in snapshot status response, will use as fallback if needed');
        }
      }
    } catch (error) {
      console.warn('Error fetching snapshot status:', error);
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

    let payload;
    if (!dataResponse.ok) {
      // If /data endpoint fails but we have snapshot status data, try using that
      if (snapshotStatusData && (snapshotStatusData.url || snapshotStatusData.post_id)) {
        console.warn('Data endpoint failed, but using data from snapshot status response');
        payload = [snapshotStatusData];
      } else {
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
    } else {
      payload = await dataResponse.json();
    }
    
    // Ensure payload is an array
    if (!Array.isArray(payload)) {
      payload = [payload];
    }
    
    console.log('Data downloaded, processing...', { recordCount: payload.length });

    // Call Supabase function to ingest data
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Retrieve submission metadata (skip_validation flag) if available
    let skipValidation = false;
    if (supabaseAdmin) {
      const { data: metadata } = await supabaseAdmin
        .from('submission_metadata')
        .select('skip_validation')
        .eq('snapshot_id', snapshot_id)
        .maybeSingle();
      
      if (metadata) {
        skipValidation = metadata.skip_validation ?? false;
        console.log('Found metadata, skip_validation:', skipValidation);
      }
    }

    const { data, error } = await supabaseAdmin.rpc('ingest_brightdata_snapshot_v2', {
      p_snapshot_id: snapshot_id,
      p_dataset_id: dataset_id || '',
      p_payload: payload,
      p_skip_validation: skipValidation
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
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('submission_metadata')
        .delete()
        .eq('snapshot_id', snapshot_id);
      console.log('Cleaned up submission metadata for snapshot:', snapshot_id);
    }

    return NextResponse.json({
      ok: true,
      snapshotId: snapshot_id,
      result: data,
      message: 'Data successfully processed and stored in database'
    });

  } catch (error) {
    console.error('Manual webhook processing error:', error);
    return NextResponse.json(
      { 
        error: 'Manual webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Manual Webhook Trigger Endpoint',
    status: 'active',
    usage: 'POST with { snapshot_id, dataset_id?, bypass_auth: true }'
  });
}
