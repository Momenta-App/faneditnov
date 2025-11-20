import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/homepage
 * Returns all homepage data from cache in a single request
 * Much faster than individual API calls
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  try {
    // Homepage data is public - no authentication required
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    
    // Map frontend time range to database column suffix
    const timeRangeSuffix = timeRange === 'all' ? 'alltime' : 
                           timeRange === '1y' || timeRange === 'year' ? 'year' : 
                           'month';
    
    console.log('[Homepage API] Fetching cache with timeRange:', timeRange, 'suffix:', timeRangeSuffix);
    
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
    
    console.log('[Homepage API] Cache fetch result:', { 
      hasCache: !!cache, 
      error: error?.message,
      total_videos: cache?.total_videos,
      total_views: cache?.total_views,
      total_creators: cache?.total_creators
    });

    if (error) {
      console.error('Error fetching homepage cache:', error);
      
      // If cache doesn't exist, calculate stats directly from database
      console.log('Cache not found, calculating stats directly from database...');
      
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
        data: {
          stats: {
            videos: {
              count: videosCount || 0,
              formatted: formatStat(videosCount || 0),
              label: 'Clips'
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
          topVideos: [],
          topCreators: [],
          cacheStatus: 'fallback'
        }
      }, { status: 200 });
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

    // Always use cache values directly from homepage_cache table
    // Use 0 as default if null (0 is a valid value meaning no data yet)
    const totalVideos = cache.total_videos ?? 0;
    const totalViews = cache.total_views ?? 0;
    const totalCreators = cache.total_creators ?? 0;

    const responseData = {
      success: true,
      data: {
        stats: {
          videos: {
            count: totalVideos,
            formatted: formatStat(totalVideos),
            label: 'Clips'
          },
          views: {
            count: totalViews,
            formatted: formatStat(totalViews),
            label: 'Global Views'
          },
          creators: {
            count: totalCreators,
            formatted: formatStat(totalCreators),
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
    };

    console.log('[Homepage API] Returning response:', {
      videos: responseData.data.stats.videos.formatted,
      views: responseData.data.stats.views.formatted,
      creators: responseData.data.stats.creators.formatted
    });

    return NextResponse.json(responseData);

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

