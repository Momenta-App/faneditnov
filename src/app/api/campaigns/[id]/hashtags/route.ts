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
      .select('video_ids, hashtags, linked_hashtags')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const videoIds = (campaign.video_ids as string[]) || [];
    
    // Get all campaign hashtags - prefer linked_hashtags (TEXT[]), fall back to hashtags (JSONB)
    let allCampaignHashtags: string[] = [];
    if (campaign.linked_hashtags && Array.isArray(campaign.linked_hashtags) && campaign.linked_hashtags.length > 0) {
      allCampaignHashtags = campaign.linked_hashtags as string[];
    } else if (campaign.hashtags) {
      // Fall back to JSONB hashtags if linked_hashtags is empty
      const hashtagsJson = campaign.hashtags as string[];
      if (Array.isArray(hashtagsJson)) {
        allCampaignHashtags = hashtagsJson;
      }
    }

    // Normalize hashtags (lowercase, remove #)
    allCampaignHashtags = allCampaignHashtags.map(tag => 
      tag.toLowerCase().replace(/^#/, '').trim()
    ).filter(tag => tag.length > 0);

    // If no hashtags, return empty array
    if (allCampaignHashtags.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Initialize stats for all campaign hashtags (even if they have 0 stats)
    const hashtagStats = new Map<
      string,
      { total_views: number; video_count: number }
    >();

    allCampaignHashtags.forEach(hashtag => {
      hashtagStats.set(hashtag, { total_views: 0, video_count: 0 });
    });

    // If there are videos, calculate stats from them
    if (videoIds.length > 0) {
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

      // Track unique videos per hashtag
      const uniqueVideoHashtags = new Map<string, Set<string>>();

      videoHashtags?.forEach((vh) => {
        const normalizedHashtag = vh.hashtag.toLowerCase().replace(/^#/, '').trim();
        
        // Only count hashtags that are in the campaign's hashtag list
        if (!allCampaignHashtags.includes(normalizedHashtag)) return;

        const stats = hashtagStats.get(normalizedHashtag) || { total_views: 0, video_count: 0 };
        const views = videoViewsMap.get(vh.video_id) || 0;
        stats.total_views += views;

        // Track unique videos
        if (!uniqueVideoHashtags.has(normalizedHashtag)) {
          uniqueVideoHashtags.set(normalizedHashtag, new Set());
        }
        uniqueVideoHashtags.get(normalizedHashtag)?.add(vh.video_id);

        hashtagStats.set(normalizedHashtag, stats);
      });

      // Update video_count with unique counts
      uniqueVideoHashtags.forEach((videoSet, hashtag) => {
        const stats = hashtagStats.get(hashtag);
        if (stats) {
          stats.video_count = videoSet.size;
        }
      });
    }

    // Get hashtag details for global stats (for all campaign hashtags)
    const { data: hashtags } = await supabaseAdmin
      .from('hashtags_hot')
      .select('hashtag, hashtag_norm, views_total, videos_count')
      .in('hashtag', allCampaignHashtags);

    // Format response - include ALL campaign hashtags, even with 0 stats
    const formattedData = Array.from(hashtagStats.entries())
      .map(([hashtag, stats]) => {
        const hashtagDetails = hashtags?.find((h) => 
          h.hashtag.toLowerCase() === hashtag.toLowerCase()
        );
        return {
          hashtag,
          hashtag_norm: hashtagDetails?.hashtag_norm || hashtag,
          total_views: stats.total_views,
          video_count: stats.video_count,
          global_views: hashtagDetails?.views_total || 0,
          global_videos: hashtagDetails?.videos_count || 0,
        };
      })
      // Sort by total views (descending), but keep all hashtags
      .sort((a, b) => b.total_views - a.total_views);

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

