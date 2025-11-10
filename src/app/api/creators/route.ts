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
      '1y': 365,
      'year': 365,
    };

    const days = timeRangeToDays[timeRange] ?? null;

    let data: any[];
    let error: any;

    // Use RPC function for time-windowed queries or all-time
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'get_creators_by_timerange',
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
      console.error('Error fetching creators:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const creators = data?.map((creator: any) => ({
      id: creator.creator_id,
      username: creator.username,
      displayName: creator.display_name || creator.username,
      bio: creator.bio || '',
      avatar: creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name || creator.username)}&background=120F23&color=fff`,
      verified: creator.verified || false,
      followers: creator.followers_count || 0,
      videos: creator.videos_count || 0,
      likes: creator.likes_total || 0,
      views: creator.total_play_count || 0,
      impact: creator.total_impact_score || 0,
    })) || [];

    return NextResponse.json({ data: creators });
  } catch (error) {
    console.error('Error in creators API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

