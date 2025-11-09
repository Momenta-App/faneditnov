import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side environment variables
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const snapshotId = searchParams.get('snapshot_id');

    if (!snapshotId) {
      return NextResponse.json(
        { error: 'snapshot_id parameter is required' },
        { status: 400 }
      );
    }

    // Check BrightData snapshot status
    let snapshotStatus = null;
    let snapshotError = null;
    
    try {
      const response = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        }
      );

      if (response.ok) {
        snapshotStatus = await response.json();
      } else {
        snapshotError = `API returned ${response.status}: ${await response.text()}`;
      }
    } catch (error) {
      snapshotError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check database for this snapshot
    let dbRecord = null;
    let dbError = null;
    
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('bd_ingestions')
          .select('*')
          .eq('snapshot_id', snapshotId)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          dbError = error.message;
        } else {
          dbRecord = data;
        }
      } catch (error) {
        dbError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return NextResponse.json({
      snapshot_id: snapshotId,
      timestamp: new Date().toISOString(),
      brightdata_status: snapshotStatus,
      brightdata_error: snapshotError,
      database_record: dbRecord,
      database_error: dbError,
      analysis: {
        is_webhook_configured: snapshotStatus?.status === 'ready' && !dbRecord ? 'Likely not configured' : 'Unknown',
        snapshot_ready: snapshotStatus?.status === 'ready',
        data_in_db: !!dbRecord,
        next_steps: snapshotStatus?.status === 'ready' && !dbRecord 
          ? 'Webhook likely not configured in BrightData dashboard' 
          : snapshotStatus?.status !== 'ready' 
          ? 'Snapshot still processing, wait for webhook' 
          : 'Data should be in database'
      }
    });

  } catch (error) {
    console.error('Diagnostic API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
