import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Returns platform-wide statistics for the homepage
 */
export async function GET() {
  try {
    // Fetch from homepage cache for instant response
    const { data: cache, error: cacheError } = await supabaseAdmin
      .from('homepage_cache')
      .select('total_videos, total_views, total_creators, stats_updated_at')
      .eq('id', 'singleton')
      .single();

    // If cache doesn't exist or error, fall back to direct queries
    if (cacheError || !cache) {
      console.warn('Homepage cache not available, using direct queries:', cacheError?.message);
      
      // Get total number of videos (edits)
      const { count: videosCount, error: videosError } = await supabaseAdmin
        .from('videos_hot')
        .select('*', { count: 'exact', head: true });

      if (videosError) {
        console.error('Error fetching videos count:', videosError);
      }

      // Get total number of creators
      const { count: creatorsCount, error: creatorsError } = await supabaseAdmin
        .from('creators_hot')
        .select('*', { count: 'exact', head: true });

      if (creatorsError) {
        console.error('Error fetching creators count:', creatorsError);
      }

      // Get total views across all videos
      const { data: viewsData, error: viewsError } = await supabaseAdmin
        .from('videos_hot')
        .select('views_count');

      if (viewsError) {
        console.error('Error fetching total views:', viewsError);
      }

      const totalViews = viewsData?.reduce((sum, video) => sum + (video.views_count || 0), 0) || 0;

      // Format numbers for display
      const formatStat = (num: number): string => {
        if (num >= 1000000000000) {
          return `${(num / 1000000000000).toFixed(1)}T+`;
        } else if (num >= 1000000000) {
          return `${(num / 1000000000).toFixed(1)}B+`;
        } else if (num >= 1000000) {
          return `${(num / 1000000).toFixed(1)}M+`;
        } else if (num >= 1000) {
          return `${(num / 1000).toFixed(1)}K+`;
        }
        return `${num}+`;
      };

      return NextResponse.json({
        success: true,
        stats: {
          videos: {
            count: videosCount || 0,
            formatted: formatStat(videosCount || 0),
            label: 'Epic Edits'
          },
          views: {
            count: totalViews,
            formatted: formatStat(totalViews),
            label: 'Global Views'
          },
          creators: {
            count: creatorsCount || 0,
            formatted: formatStat(creatorsCount || 0),
            label: 'Talented Creators'
          }
        },
        source: 'fallback'
      });
    }

    // Use cached values (fast path)
    const formatStat = (num: number): string => {
      if (num >= 1000000000000) {
        return `${(num / 1000000000000).toFixed(1)}T+`;
      } else if (num >= 1000000000) {
        return `${(num / 1000000000).toFixed(1)}B+`;
      } else if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M+`;
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K+`;
      }
      return `${num}+`;
    };

    return NextResponse.json({
      success: true,
      stats: {
        videos: {
          count: cache.total_videos || 0,
          formatted: formatStat(cache.total_videos || 0),
          label: 'Epic Edits'
        },
        views: {
          count: cache.total_views || 0,
          formatted: formatStat(cache.total_views || 0),
          label: 'Global Views'
        },
        creators: {
          count: cache.total_creators || 0,
          formatted: formatStat(cache.total_creators || 0),
          label: 'Talented Creators'
        }
      },
      source: 'cache',
      cached_at: cache.stats_updated_at
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        stats: {
          videos: { count: 0, formatted: '0+', label: 'Epic Edits' },
          views: { count: 0, formatted: '0+', label: 'Global Views' },
          creators: { count: 0, formatted: '0+', label: 'Talented Creators' }
        }
      },
      { status: 500 }
    );
  }
}

