import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/[id]/creators
 * Get creators for a campaign
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
      return NextResponse.json({ data: [] });
    }

    // Get videos with creator info
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select('creator_id, views_count, impact_score')
      .in('video_id', videoIds);

    if (videosError) throw videosError;

    // Aggregate by creator
    const creatorStats = new Map<
      string,
      { total_views: number; total_impact: number; video_count: number }
    >();

    videos?.forEach((video) => {
      if (!video.creator_id) return;

      const existing =
        creatorStats.get(video.creator_id) || {
          total_views: 0,
          total_impact: 0,
          video_count: 0,
        };
      existing.total_views += video.views_count || 0;
      existing.total_impact += video.impact_score || 0;
      existing.video_count += 1;
      creatorStats.set(video.creator_id, existing);
    });

    // Sort by total views (descending)
    const sortedCreators = Array.from(creatorStats.entries())
      .sort((a, b) => b[1].total_views - a[1].total_views)
      .slice(0, 50);

    if (sortedCreators.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get creator details
    const creatorIds = sortedCreators.map(([creatorId]) => creatorId);
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from('creators_hot')
      .select('creator_id, username, display_name, avatar_url, verified, bio')
      .in('creator_id', creatorIds);

    if (creatorsError) throw creatorsError;

    // Format response
    const formattedData = sortedCreators.map(([creatorId, stats]) => {
      const creator = creators?.find((c) => c.creator_id === creatorId);
      return {
        creator_id: creatorId,
        username: creator?.username || '',
        display_name: creator?.display_name || '',
        avatar_url: creator?.avatar_url || '',
        verified: creator?.verified || false,
        bio: creator?.bio || '',
        total_views: stats.total_views,
        total_impact_score: stats.total_impact,
        video_count: stats.video_count,
      };
    });

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching campaign creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign creators' },
      { status: 500 }
    );
  }
}

