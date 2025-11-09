import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const snapshotId = searchParams.get('snapshot_id');

    if (snapshotId) {
      // Get specific ingestion status
      const { data: ingestion, error: ingestionError } = await supabaseAdmin
        .from('bd_ingestions')
        .select('*')
        .eq('snapshot_id', snapshotId)
        .single();

      if (ingestionError) {
        return NextResponse.json(
          { error: 'Ingestion not found', details: ingestionError.message },
          { status: 404 }
        );
      }

      // Get raw records count
      const { count: rawCount } = await supabaseAdmin
        .from('bd_raw_records')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_id', snapshotId);

      // Get processed posts count
      const { count: processedCount } = await supabaseAdmin
        .from('tiktok_posts')
        .select('*', { count: 'exact', head: true })
        .eq('input_url', snapshotId); // This might need adjustment based on your schema

      return NextResponse.json({
        snapshot_id: snapshotId,
        ingestion,
        raw_records_count: rawCount || 0,
        processed_posts_count: processedCount || 0,
      });
    } else {
      // Get all recent ingestions
      const { data: ingestions, error } = await supabaseAdmin
        .from('bd_ingestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch ingestions', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        recent_ingestions: ingestions,
        total_count: ingestions?.length || 0,
      });
    }

  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
