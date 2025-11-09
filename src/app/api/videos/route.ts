import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default
    const timeRange = searchParams.get('timeRange') || 'all';
    const impactMin = parseFloat(searchParams.get('impact_min') || '0');
    const impactMax = parseFloat(searchParams.get('impact_max') || '999999999');
    
    // Deduplication is opt-in only - used specifically for homepage "Hall of Fame"
    // By default, all videos are returned regardless of creator
    const deduplicate = searchParams.get('deduplicate') === 'true' || 
                        searchParams.get('homepage') === 'true';
    
    // Only fetch extra results if deduplication is enabled (to account for filtering)
    const fetchLimit = deduplicate ? Math.max(limit * 2, 50) : limit;
    
    // Query from new hot tables with join to creators
    let query = supabaseAdmin
      .from('videos_hot')
      .select(`
        *,
        creator:creators_hot!videos_hot_creator_id_fkey(
          creator_id,
          username,
          display_name,
          avatar_url,
          verified
        )
      `)
      .limit(fetchLimit)
      .range(offset, offset + fetchLimit - 1);

    // Apply time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      const daysAgo = {
        '7d': 7,
        '30d': 30,
        '1y': 365,
      }[timeRange] || 0;
      
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Apply impact filters
    if (impactMin > 0) {
      query = query.gte('impact_score', impactMin);
    }
    if (impactMax < 999999999) {
      query = query.lte('impact_score', impactMax);
    }

    // Apply search filter
    if (search) {
      query = query.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('impact_score', { ascending: false });
        break;
      case 'views':
        query = query.order('views_count', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('views_count', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match frontend expectations
    let transformedData = data?.map((video: any) => ({
      id: video.video_id,
      postId: video.post_id || video.video_id,
      title: video.caption || 'Untitled',
      description: video.description || video.caption || '',
      thumbnail: video.cover_url || '',
      videoUrl: video.video_url || video.url || '',
      creator: {
        id: video.creator?.creator_id || 'unknown',
        username: video.creator?.username || 'unknown',
        avatar: video.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator?.display_name || 'User')}&background=120F23&color=fff`,
        verified: video.creator?.verified || false,
      },
      views: video.views_count || 0,
      likes: video.likes_count || 0,
      comments: video.comments_count || 0,
      shares: video.shares_count || 0,
      saves: video.collect_count || 0,
      impact: video.impact_score || 0, // Add impact to response
      duration: video.duration_seconds || 0,
      createdAt: video.created_at,
      hashtags: [], // Will be populated from video_hashtag_facts if needed
    })) || [];

    // Only deduplicate if explicitly requested (for homepage use cases)
    // By default, return all videos regardless of creator
    let finalData;
    
    if (deduplicate) {
      // Deduplicate by creator - keep only the video with highest impact score per creator
      // This ensures homepage "Hall of Fame" shows only one video per creator
      const creatorMap = new Map<string, any>();
      
      for (const video of transformedData) {
        const creatorId = video.creator.id;
        if (creatorId === 'unknown') continue; // Skip videos without valid creator
        
        const existing = creatorMap.get(creatorId);
        
        // Keep the video with the highest impact score for this creator
        if (!existing || video.impact > existing.impact) {
          creatorMap.set(creatorId, video);
        }
      }
      
      // Convert map back to array and maintain original sort order by re-sorting
      const deduplicatedData = Array.from(creatorMap.values());
      
      // Re-sort based on the original sort criteria
      switch (sortBy) {
        case 'impact':
          deduplicatedData.sort((a, b) => b.impact - a.impact);
          break;
        case 'views':
          deduplicatedData.sort((a, b) => b.views - a.views);
          break;
        case 'likes':
          deduplicatedData.sort((a, b) => b.likes - a.likes);
          break;
        case 'recent':
          deduplicatedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        default:
          deduplicatedData.sort((a, b) => b.views - a.views);
      }
      
      // Slice to the requested limit after deduplication
      finalData = deduplicatedData.slice(0, limit);
    } else {
      // No deduplication - return all videos up to the limit
      finalData = transformedData.slice(0, limit);
    }

    return NextResponse.json({ data: finalData });
  } catch (error) {
    console.error('Error in videos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

