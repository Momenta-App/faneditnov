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
      'get_sounds_by_timerange',
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
      console.error('Error fetching sounds:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const sounds = data?.map((sound: any) => ({
      id: sound.sound_id,
      title: sound.sound_title,
      author: sound.sound_author || 'Unknown Artist',
      duration: sound.music_duration || 0,
      thumbnail: sound.cover_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sound.sound_title)}&background=6366f1&color=fff&size=128`,
      videos: sound.videos_count || 0,
      views: sound.views_total || 0,
      likes: sound.likes_total || 0,
      impact: sound.total_impact_score || 0,
    })) || [];

    return NextResponse.json({ data: sounds });
  } catch (error) {
    console.error('Error in sounds API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
