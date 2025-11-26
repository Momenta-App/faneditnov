import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/refresh-stats
 * Manually refresh homepage statistics
 * Requires admin role
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireRole(request, 'admin');

    // Refresh stats
    const { data, error } = await supabaseAdmin.rpc('update_homepage_stats');

    if (error) {
      console.error('Error refreshing stats:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stats refreshed successfully',
      data
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }
    
    console.error('Admin refresh stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh stats'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/refresh-stats
 * Get current stats and cache status
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireRole(request, 'admin');

    // Get current cache values
    const { data: cache, error } = await supabaseAdmin
      .from('homepage_cache')
      .select('total_videos, total_views, total_creators, stats_updated_at')
      .eq('id', 'singleton')
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        cacheExists: false
      });
    }

    // Also get actual counts from database for comparison
    const { count: actualVideos } = await supabaseAdmin
      .from('videos_hot')
      .select('*', { count: 'exact', head: true });

    const { count: actualCreators } = await supabaseAdmin
      .from('creators_hot')
      .select('*', { count: 'exact', head: true });

    const { data: viewsData } = await supabaseAdmin
      .from('videos_hot')
      .select('views_count');

    const actualViews = viewsData?.reduce((sum, video) => sum + (video.views_count || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      cache: {
        videos: cache?.total_videos ?? null,
        views: cache?.total_views ?? null,
        creators: cache?.total_creators ?? null,
        updatedAt: cache?.stats_updated_at
      },
      actual: {
        videos: actualVideos ?? 0,
        views: actualViews,
        creators: actualCreators ?? 0
      },
      needsRefresh: 
        (cache?.total_videos ?? 0) !== (actualVideos ?? 0) ||
        (cache?.total_views ?? 0) !== actualViews ||
        (cache?.total_creators ?? 0) !== (actualCreators ?? 0)
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }
    
    console.error('Admin get stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      },
      { status: 500 }
    );
  }
}

