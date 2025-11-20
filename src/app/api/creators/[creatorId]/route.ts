import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creators/[creatorId]
 * Get a single creator by ID or username
 */
export async function GET(
  request: Request,
  { params }: { params: { creatorId: string } }
) {
  try {
    const creatorId = decodeURIComponent(params.creatorId);

    // Try to find creator by creator_id first, then by username
    let { data: creator, error } = await supabaseAdmin
      .from('creators_hot')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    // If not found by creator_id, try username
    if (error && error.code === 'PGRST116') {
      const { data: creatorByUsername, error: usernameError } = await supabaseAdmin
        .from('creators_hot')
        .select('*')
        .eq('username', creatorId)
        .single();

      if (usernameError) {
        // Creator not found
        return NextResponse.json(
          { error: 'Creator not found' },
          { status: 404 }
        );
      }

      creator = creatorByUsername;
      error = null;
    }

    if (error || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Get creator's videos for accurate counts
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select('video_id, views_count, likes_count, impact_score')
      .eq('creator_id', creator.creator_id);

    if (videosError) {
      console.error('Error fetching creator videos:', videosError);
    }

    // Calculate aggregates from videos
    const videos_count = videos?.length || 0;
    const total_views = videos?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
    const likes_total = videos?.reduce((sum, v) => sum + (v.likes_count || 0), 0) || 0;
    const total_impact_score = videos?.reduce((sum, v) => sum + (v.impact_score || 0), 0) || 0;

    // Transform to match frontend expectations
    const formattedCreator = {
      id: creator.creator_id,
      username: creator.username,
      displayName: creator.display_name || creator.username,
      bio: creator.bio || '',
      avatar: creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name || creator.username)}&background=120F23&color=fff`,
      verified: creator.verified || false,
      followers: creator.followers_count || 0,
      videos: videos_count,
      likes: likes_total,
      views: total_views,
      impact: total_impact_score,
    };

    return NextResponse.json({ data: formattedCreator });
  } catch (error) {
    console.error('Error in creator API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

