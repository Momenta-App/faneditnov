import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/[id]/hashtags
 * Get hashtags for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    // Get campaign to verify ownership and get video_ids and hashtags
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('video_ids, hashtags')
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
    const campaignHashtags = campaign.hashtags as string[];

    if (videoIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get hashtags from video_hashtag_facts for these videos
    const { data: videoHashtags, error: vhError } = await supabaseAdmin
      .from('video_hashtag_facts')
      .select('hashtag, video_id')
      .in('video_id', videoIds);

    if (vhError) throw vhError;

    // Get video views for accurate counts
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select('video_id, views_count')
      .in('video_id', videoIds);

    if (videosError) throw videosError;

    const videoViewsMap = new Map(
      videos?.map((v) => [v.video_id, v.views_count || 0]) || []
    );

    // Aggregate by hashtag (only for hashtags in campaign)
    const hashtagStats = new Map<
      string,
      { total_views: number; video_count: number }
    >();

    videoHashtags?.forEach((vh) => {
      // Only count hashtags that are in the campaign's hashtag list
      if (!campaignHashtags.includes(vh.hashtag)) return;

      const existing =
        hashtagStats.get(vh.hashtag) || { total_views: 0, video_count: 0 };
      const views = videoViewsMap.get(vh.video_id) || 0;
      existing.total_views += views;
      
      // Count unique videos per hashtag
      if (!hashtagStats.has(vh.hashtag)) {
        existing.video_count = 1;
      } else {
        // We need to track unique videos, so we'll do a second pass
        existing.video_count += 1;
      }
      
      hashtagStats.set(vh.hashtag, existing);
    });

    // Fix video_count to be unique videos per hashtag
    const uniqueVideoHashtags = new Map<string, Set<string>>();
    videoHashtags?.forEach((vh) => {
      if (!campaignHashtags.includes(vh.hashtag)) return;
      if (!uniqueVideoHashtags.has(vh.hashtag)) {
        uniqueVideoHashtags.set(vh.hashtag, new Set());
      }
      uniqueVideoHashtags.get(vh.hashtag)?.add(vh.video_id);
    });

    // Update video_count with unique counts
    uniqueVideoHashtags.forEach((videoSet, hashtag) => {
      const stats = hashtagStats.get(hashtag);
      if (stats) {
        stats.video_count = videoSet.size;
      }
    });

    // Sort by total views (descending)
    const sortedHashtags = Array.from(hashtagStats.entries())
      .sort((a, b) => b[1].total_views - a[1].total_views)
      .slice(0, 50);

    if (sortedHashtags.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get hashtag details for global stats
    const hashtagNames = sortedHashtags.map(([hashtag]) => hashtag);
    const { data: hashtags } = await supabaseAdmin
      .from('hashtags_hot')
      .select('hashtag, hashtag_norm, views_total, videos_count')
      .in('hashtag', hashtagNames);

    // Format response
    const formattedData = sortedHashtags.map(([hashtag, stats]) => {
      const hashtagDetails = hashtags?.find((h) => h.hashtag === hashtag);
      return {
        hashtag,
        hashtag_norm: hashtagDetails?.hashtag_norm || hashtag,
        total_views: stats.total_views,
        video_count: stats.video_count,
        global_views: hashtagDetails?.views_total || 0,
        global_videos: hashtagDetails?.videos_count || 0,
      };
    });

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching campaign hashtags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign hashtags' },
      { status: 500 }
    );
  }
}

