import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/[id]
 * Get campaign details with aggregates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    // Get campaign (RLS will ensure user can only see their own)
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id) // Extra check for security
      .single();

    if (error) throw error;

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Calculate aggregates from video_ids
    const videoIds = campaign.video_ids as string[];

    if (videoIds.length === 0) {
      return NextResponse.json({
        ...campaign,
        total_views: 0,
        total_videos: 0,
        total_creators: 0,
      });
    }

    // Get video data to calculate aggregates
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select('video_id, views_count, creator_id, likes_count')
      .in('video_id', videoIds);

    if (videosError) {
      console.error('Error fetching videos for aggregates:', videosError);
      // Return campaign without aggregates if query fails
      return NextResponse.json({
        ...campaign,
        total_views: 0,
        total_videos: videoIds.length,
        total_creators: 0,
      });
    }

    // Calculate aggregates
    const totalViews = videos?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
    const totalVideos = videos?.length || 0;
    const uniqueCreators = new Set(videos?.map((v) => v.creator_id).filter(Boolean) || []);
    const totalCreators = uniqueCreators.size;

    return NextResponse.json({
      ...campaign,
      total_views: totalViews,
      total_videos: totalVideos,
      total_creators: totalCreators,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

