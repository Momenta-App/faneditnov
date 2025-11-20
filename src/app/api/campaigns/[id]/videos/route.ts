import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { detectPlatform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/[id]/videos
 * Get videos for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    // Get campaign to verify ownership and get video_ids
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('video_ids')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const videoIds = campaign.video_ids as string[];

    if (videoIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit: 100,
        offset: 0,
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const timeRange = searchParams.get('timeRange') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build time filter
    let cutoffDate: string | null = null;
    if (timeRange !== 'all') {
      const now = new Date();
      let cutoff = new Date();

      switch (timeRange) {
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoff.setDate(now.getDate() - 30);
          break;
        case '1y':
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
      }
      cutoffDate = cutoff.toISOString();
    }

    // Query videos from videos_hot
    let query = supabaseAdmin.from('videos_hot').select('*').in('video_id', videoIds);

    if (cutoffDate) {
      query = query.gte('created_at', cutoffDate);
    }

    if (search) {
      query = query.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('impact_score', { ascending: false });
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

    const { data: allVideos, error: videosError } = await query;

    if (videosError) throw videosError;

    // Apply pagination
    const total = allVideos?.length || 0;
    const paginatedVideos = (allVideos || []).slice(offset, offset + limit);

    // Fetch creator data
    const creatorIds = [
      ...new Set(paginatedVideos.map((v) => v.creator_id).filter(Boolean)),
    ];
    const { data: creators } = await supabaseAdmin
      .from('creators_hot')
      .select('creator_id, username, display_name, avatar_url, verified')
      .in('creator_id', creatorIds);

    const creatorsMap = new Map(creators?.map((c) => [c.creator_id, c]) || []);

    // Fetch hashtags
    const videoIdsToGetHashtags = paginatedVideos.map((v) => v.video_id);
    const hashtagsMap = new Map<string, string[]>();

    if (videoIdsToGetHashtags.length > 0) {
      const { data: hashtags } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('video_id, hashtag')
        .in('video_id', videoIdsToGetHashtags);

      hashtags?.forEach((h) => {
        if (!hashtagsMap.has(h.video_id)) {
          hashtagsMap.set(h.video_id, []);
        }
        hashtagsMap.get(h.video_id)?.push(h.hashtag);
      });
    }

    // Format response
    const formattedData = paginatedVideos.map((video) => {
      const creatorData = creatorsMap.get(video.creator_id);
      const creatorUsername = creatorData?.username || 'Unknown';
      const creatorDisplayName = creatorData?.display_name || creatorUsername;
      const creatorAvatarUrl = creatorData?.avatar_url || '';

      // Provide fallback avatar if missing
      const creatorAvatar =
        creatorAvatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorDisplayName)}&background=120F23&color=fff`;

      return {
        id: video.video_id,
        postId: video.post_id,
        title: video.caption?.substring(0, 100) || '',
        description: video.description || '',
        thumbnail: video.cover_url || '',
        videoUrl: video.video_url || '',
        platform:
          video.platform ||
          (video.video_url ? detectPlatform(video.video_url) : 'unknown'),
        creator: {
          id: video.creator_id,
          username: creatorUsername,
          avatar: creatorAvatar,
          verified: creatorData?.verified || false,
        },
        views: video.views_count || 0,
        likes: video.likes_count || 0,
        comments: video.comments_count || 0,
        shares: video.shares_count || 0,
        saves: video.collect_count || 0,
        impact: video.impact_score || 0,
        duration: video.duration_seconds || 0,
        createdAt: video.created_at,
        hashtags: hashtagsMap.get(video.video_id) || [],
        isEdit: true, // Campaigns only use videos_hot, so all are edit videos
      };
    });

    return NextResponse.json({
      data: formattedData,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching campaign videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign videos' },
      { status: 500 }
    );
  }
}

