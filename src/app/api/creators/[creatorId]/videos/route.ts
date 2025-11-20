import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creators/[creatorId]/videos
 * Get videos for a specific creator by ID or username
 */
export async function GET(
  request: Request,
  { params }: { params: { creatorId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100') || 100;
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const timeRange = searchParams.get('timeRange') || 'all';

    const creatorId = decodeURIComponent(params.creatorId);

    // First, find the creator by ID or username
    let { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators_hot')
      .select('creator_id, username')
      .eq('creator_id', creatorId)
      .single();

    // If not found by creator_id, try username
    if (creatorError && creatorError.code === 'PGRST116') {
      const { data: creatorByUsername, error: usernameError } = await supabaseAdmin
        .from('creators_hot')
        .select('creator_id, username')
        .eq('username', creatorId)
        .single();

      if (usernameError || !creatorByUsername) {
        return NextResponse.json(
          { error: 'Creator not found', data: [], total: 0 },
          { status: 404 }
        );
      }

      creator = creatorByUsername;
    }

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found', data: [], total: 0 },
        { status: 404 }
      );
    }

    const actualCreatorId = creator.creator_id;

    // Query videos for this creator
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
      .eq('creator_id', actualCreatorId);

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

    // Apply search filter
    if (search) {
      query = query.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('impact_score', { ascending: false, nullsFirst: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'views':
      default:
        query = query.order('views_count', { ascending: false });
        break;
    }

    // Get total count first (for pagination)
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('videos_hot')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', actualCreatorId);

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching creator videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get hashtags for videos
    const videoIds = data?.map((v: any) => v.video_id) || [];
    let hashtagsMap: Record<string, string[]> = {};
    
    if (videoIds.length > 0) {
      const { data: hashtagsData } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('video_id, hashtag')
        .in('video_id', videoIds);
      
      hashtagsMap = hashtagsData?.reduce((acc, item) => {
        if (!acc[item.video_id]) {
          acc[item.video_id] = [];
        }
        acc[item.video_id].push(item.hashtag);
        return acc;
      }, {} as Record<string, string[]>) || {};
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map((video: any) => {
      const detectedPlatform = video.platform || (video.url || video.video_url ? detectPlatform(video.url || video.video_url) : 'unknown');
      
      let videoUrl = video.video_url || video.url || '';
      if (!videoUrl && detectedPlatform === 'youtube' && video.post_id) {
        videoUrl = `https://www.youtube.com/watch?v=${video.post_id}`;
      }

      return {
        id: video.video_id,
        postId: video.post_id || video.video_id,
        title: video.caption || 'Untitled',
        description: video.description || video.caption || '',
        thumbnail: video.cover_url || '',
        videoUrl: videoUrl,
        platform: detectedPlatform,
        creator: {
          id: video.creator?.creator_id || actualCreatorId,
          username: video.creator?.username || creator.username,
          avatar: video.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator?.display_name || creator.username)}&background=120F23&color=fff`,
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
      };
    }) || [];

    return NextResponse.json({
      data: transformedData,
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in creator videos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

