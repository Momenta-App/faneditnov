import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default
    const timeRange = searchParams.get('timeRange') || 'all';

    // Map timeRange to days for database function
    const timeRangeToDays: { [key: string]: number | null } = {
      'all': null,
      '7d': 7,
      '30d': 30,
      'year': 365,
    };

    const days = timeRangeToDays[timeRange] ?? null;

    let data: any[];
    let error: any;

    // Use RPC function for time-windowed queries or all-time
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'get_hashtags_by_timerange',
      {
        p_days: days,
        p_sort_by: sortBy,
        p_search: search || null,
        p_limit: limit,
      }
    );

    data = rpcData;
    error = rpcError;

    if (error) {
      console.error('Error fetching hashtags:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const hashtags = data?.map((hashtag: any) => ({
      id: hashtag.hashtag,
      name: hashtag.hashtag_norm || hashtag.hashtag,
      views: hashtag.views_total || 0,
      videos: hashtag.videos_count || 0,
      creators: hashtag.creators_count || 0,
      impact: hashtag.total_impact_score || 0,
      trending: hashtag.trending || false,
      description: `${hashtag.videos_count || 0} videos by ${hashtag.creators_count || 0} creators`,
    })) || [];

    return NextResponse.json({ data: hashtags });
  } catch (error) {
    console.error('Error in hashtags API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

