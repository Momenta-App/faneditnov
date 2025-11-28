/**
 * API route to get video cover image from videos_hot table
 * GET: Get cover_url for a video by its URL
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/videos/cover
 * Get cover image URL for a video
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    // Standardize URL for lookup
    const standardizedUrl = videoUrl.split('?')[0].split('#')[0];

    // Find video in videos_hot table
    const { data: video, error } = await supabaseAdmin
      .from('videos_hot')
      .select('cover_url, video_id')
      .or(`video_url.eq.${videoUrl},video_url.eq.${standardizedUrl}`)
      .maybeSingle();

    if (error) {
      console.error('[Video Cover API] Error fetching video:', error);
      return NextResponse.json(
        { error: 'Failed to fetch video cover' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cover_url: video?.cover_url || null,
      video_id: video?.video_id || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('auth')) {
      return handleAuthError(error);
    }
    console.error('[Video Cover API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

