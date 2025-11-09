import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { soundId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100') || 100;
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const timeRange = searchParams.get('timeRange') || 'all';

    const soundId = params.soundId;

    // First, get all video IDs for this sound
    const { data: soundVideos, error: soundError } = await supabaseAdmin
      .from('video_sound_facts')
      .select('video_id')
      .eq('sound_id', soundId);

    if (soundError) {
      console.error('Error fetching sound videos:', soundError);
      return NextResponse.json({ error: soundError.message }, { status: 500 });
    }

    const videoIds = soundVideos?.map((v) => v.video_id) || [];

    if (videoIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Now query videos with those IDs
    let query = supabaseAdmin
      .from('videos_hot')
      .select(`
        *,
        creator:creators_hot!videos_hot_creator_id_fkey(
          creator_id,
          username,
          display_name,
          avatar_url,
          verified
        )
      `)
      .in('video_id', videoIds)
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      const daysAgo = {
        '7d': 7,
        '30d': 30,
        '1y': 365,
      }[timeRange] || 0;
      
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('impact_score', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'views':
        query = query.order('views_count', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'trending':
        // For trending, fall back to impact
        query = query.order('impact_score', { ascending: false });
        break;
      default:
        query = query.order('views_count', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get hashtags for each video
    const videoIdsToGetHashtags = data?.map((v: any) => v.video_id) || [];
    let hashtagsMap: Record<string, string[]> = {};
    
    if (videoIdsToGetHashtags.length > 0) {
      const { data: hashtagsData } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('video_id, hashtag')
        .in('video_id', videoIdsToGetHashtags);
      
      hashtagsMap = hashtagsData?.reduce((acc, item) => {
        if (!acc[item.video_id]) {
          acc[item.video_id] = [];
        }
        acc[item.video_id].push(item.hashtag);
        return acc;
      }, {} as Record<string, string[]>) || {};
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map((video: any) => ({
      id: video.video_id,
      postId: video.post_id || video.video_id,
      title: video.caption || 'Untitled',
      description: video.description || video.caption || '',
      thumbnail: video.cover_url || '',
      videoUrl: video.video_url || video.url || '',
      creator: {
        id: video.creator?.creator_id || 'unknown',
        username: video.creator?.username || 'unknown',
        avatar: video.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator?.display_name || 'User')}&background=120F23&color=fff`,
        verified: video.creator?.verified || false,
      },
      views: video.views_count || 0,
      likes: video.likes_count || 0,
      comments: video.comments_count || 0,
      shares: video.shares_count || 0,
      saves: video.collect_count || 0,
      impact: video.impact_score || 0,
      duration: video.duration_seconds || 0,
      createdAt: video.created_at,
      hashtags: hashtagsMap[video.video_id] || [],
    })) || [];

    return NextResponse.json({ 
      data: transformedData,
      total: videoIds.length 
    });
  } catch (error) {
    console.error('Error in sound videos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}