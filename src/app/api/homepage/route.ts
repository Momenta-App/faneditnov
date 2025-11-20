import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerUserId } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/homepage
 * Returns all homepage data from cache in a single request
 * Much faster than individual API calls
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication using Supabase
    const userId = await getServerUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    
    // Map frontend time range to database column suffix
    const timeRangeSuffix = timeRange === 'all' ? 'alltime' : 
                           timeRange === '1y' || timeRange === 'year' ? 'year' : 
                           'month';
    
    // Fetch from homepage cache
    const { data: cache, error } = await supabaseAdmin
      .from('homepage_cache')
      .select(`
        total_videos,
        total_views,
        total_creators,
        top_videos_${timeRangeSuffix},
        top_creators_${timeRangeSuffix},
        stats_updated_at,
        videos_${timeRangeSuffix}_updated_at,
        creators_${timeRangeSuffix}_updated_at
      `)
      .eq('id', 'singleton')
      .single();

    if (error) {
      console.error('Error fetching homepage cache:', error);
      
      // Fallback to empty data structure if cache doesn't exist yet
      // Return 200 with error flag instead of 503 to prevent retry loops
      return NextResponse.json({
        success: false,
        error: 'Cache not initialized. Please run refresh_homepage_cache()',
        data: {
          stats: {
            videos: { count: 0, formatted: '0+', label: 'Clips' },
            views: { count: 0, formatted: '0+', label: 'Global Views' },
            creators: { count: 0, formatted: '0+', label: 'Talented Creators' }
          },
          topVideos: [],
          topCreators: [],
          cacheStatus: 'not_initialized'
        }
      }, { status: 200 }); // Changed from 503 to 200 to prevent retry loops
    }

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
      data: {
        stats: {
          videos: {
            count: cache.total_videos || 0,
            formatted: formatStat(cache.total_videos || 0),
            label: 'Clips'
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
        topVideos: (cache as any)[`top_videos_${timeRangeSuffix}`] || [],
        topCreators: (cache as any)[`top_creators_${timeRangeSuffix}`] || [],
        cacheStatus: 'active',
        timestamps: {
          stats: cache.stats_updated_at,
          videos: (cache as any)[`videos_${timeRangeSuffix}_updated_at`],
          creators: (cache as any)[`creators_${timeRangeSuffix}_updated_at`]
        }
      }
    });

  } catch (error) {
    console.error('Homepage API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch homepage data',
        data: {
          stats: {
            videos: { count: 0, formatted: '0+', label: 'Clips' },
            views: { count: 0, formatted: '0+', label: 'Global Views' },
            creators: { count: 0, formatted: '0+', label: 'Talented Creators' }
          },
          topVideos: [],
          topCreators: [],
          cacheStatus: 'error'
        }
      },
      { status: 200 } // Changed from 500 to 200 to prevent retry loops
    );
  }
}

