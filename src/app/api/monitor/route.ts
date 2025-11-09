import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Get recent ingestions (last 5)
    const { data: ingestions, error } = await supabaseAdmin
      .from('bd_ingestions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch ingestions', details: error.message },
        { status: 500 }
      );
    }

    // Get total counts
    const { count: totalIngestions } = await supabaseAdmin
      .from('bd_ingestions')
      .select('*', { count: 'exact', head: true });

    const { count: totalRawRecords } = await supabaseAdmin
      .from('bd_raw_records')
      .select('*', { count: 'exact', head: true });

    const { count: totalTikTokPosts } = await supabaseAdmin
      .from('tiktok_posts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      summary: {
        total_ingestions: totalIngestions || 0,
        total_raw_records: totalRawRecords || 0,
        total_tiktok_posts: totalTikTokPosts || 0,
      },
      recent_ingestions: ingestions || [],
    });

  } catch (error) {
    console.error('Monitor API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
