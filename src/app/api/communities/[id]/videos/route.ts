import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const timeRange = searchParams.get('timeRange') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const editsOnly = searchParams.get('editsOnly') !== 'false'; // Default true

    // Build time filter
    let cutoffDate: string | null = null;
    if (timeRange !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      
      switch (timeRange) {
        case '7d': cutoff.setDate(now.getDate() - 7); break;
        case '30d': cutoff.setDate(now.getDate() - 30); break;
        case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
      }
      cutoffDate = cutoff.toISOString();
    }

    // Step 1: Get video IDs for this community with edit filter
    let membershipQuery = supabaseAdmin
      .from('community_video_memberships')
      .select('video_id, is_edit_video')
      .eq('community_id', params.id);
    
    // Filter by editsOnly if needed
    if (editsOnly) {
      membershipQuery = membershipQuery.eq('is_edit_video', true);
    }

    const { data: memberships, error: membershipError } = await membershipQuery;

    if (membershipError) throw membershipError;

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit,
        offset
      });
    }

    // Separate video IDs by type
    const editVideoIds = memberships.filter(m => m.is_edit_video).map(m => m.video_id);
    const nonEditVideoIds = memberships.filter(m => !m.is_edit_video).map(m => m.video_id);

    let allVideos: any[] = [];

    // Step 2a: Query edit videos from videos_hot
    if (editVideoIds.length > 0) {
      let editQuery = supabaseAdmin
        .from('videos_hot')
        .select('*')
        .in('video_id', editVideoIds);

      if (cutoffDate) {
        editQuery = editQuery.gte('created_at', cutoffDate);
      }

      if (search) {
        editQuery = editQuery.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: editVideos, error: editError } = await editQuery;
      if (editError) throw editError;

      allVideos = allVideos.concat(editVideos?.map(v => ({ ...v, is_edit: true })) || []);
    }

    // Step 2b: Query non-edit videos from rejected_videos
    if (!editsOnly && nonEditVideoIds.length > 0) {
      let rejectedQuery = supabaseAdmin
        .from('rejected_videos')
        .select('*')
        .in('video_id', nonEditVideoIds);

      if (cutoffDate) {
        rejectedQuery = rejectedQuery.gte('video_created_at', cutoffDate);
      }

      if (search) {
        rejectedQuery = rejectedQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: rejectedVideos, error: rejectedError } = await rejectedQuery;
      if (rejectedError) throw rejectedError;

      // Normalize rejected videos to match videos_hot schema
      const normalizedRejected = rejectedVideos?.map(rv => ({
        video_id: rv.video_id,
        post_id: rv.post_id,
        creator_id: rv.creator_id,
        caption: rv.title,
        description: rv.description,
        cover_url: null,
        video_url: rv.tiktok_url,
        views_count: rv.views_count,
        likes_count: rv.likes_count,
        comments_count: rv.comments_count,
        shares_count: rv.shares_count,
        collect_count: 0,
        impact_score: rv.impact_score,
        duration_seconds: 0,
        created_at: rv.video_created_at,
        is_edit: false
      })) || [];

      allVideos = allVideos.concat(normalizedRejected);
    }

    // Step 3: Sort all videos
    const sortField = sortBy === 'impact' ? 'impact_score'
                   : sortBy === 'recent' ? 'created_at' 
                   : sortBy === 'likes' ? 'likes_count'
                   : 'views_count';
    
    allVideos.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return bVal - aVal; // Descending
    });

    // Step 4: Apply pagination
    const total = allVideos.length;
    const paginatedVideos = allVideos.slice(offset, offset + limit);

    // Step 5: Fetch creator data
    const creatorIds = [...new Set(paginatedVideos.map(v => v.creator_id).filter(Boolean))];
    const { data: creators } = await supabaseAdmin
      .from('creators_hot')
      .select('creator_id, username, display_name, avatar_url, verified')
      .in('creator_id', creatorIds);

    const creatorsMap = new Map(creators?.map(c => [c.creator_id, c]) || []);

    // Step 6: Fetch hashtags
    // For edit videos, get from video_hashtag_facts
    // For rejected videos, they already have hashtags in the data
    const editVideoIdsToFetch = paginatedVideos.filter(v => v.is_edit).map(v => v.video_id);
    const hashtagsMap = new Map<string, string[]>();
    
    if (editVideoIdsToFetch.length > 0) {
      const { data: hashtags } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('video_id, hashtag')
        .in('video_id', editVideoIdsToFetch);

      hashtags?.forEach(h => {
        if (!hashtagsMap.has(h.video_id)) {
          hashtagsMap.set(h.video_id, []);
        }
        hashtagsMap.get(h.video_id)?.push(h.hashtag);
      });
    }

    // For rejected videos, get hashtags from rejected_videos table
    const rejectedVideoIdsToFetch = paginatedVideos.filter(v => !v.is_edit).map(v => v.video_id);
    if (rejectedVideoIdsToFetch.length > 0) {
      const { data: rejectedHashtags } = await supabaseAdmin
        .from('rejected_videos')
        .select('video_id, hashtags')
        .in('video_id', rejectedVideoIdsToFetch);

      rejectedHashtags?.forEach(rh => {
        if (rh.hashtags) {
          hashtagsMap.set(rh.video_id, rh.hashtags);
        }
      });
    }

    // Step 7: Format response
    const formattedData = paginatedVideos.map(video => {
      const creatorData = creatorsMap.get(video.creator_id);
      const creatorUsername = creatorData?.username || 'Unknown';
      const creatorDisplayName = creatorData?.display_name || creatorUsername;
      const creatorAvatarUrl = creatorData?.avatar_url || '';
      
      // Provide fallback avatar if missing
      const creatorAvatar = creatorAvatarUrl || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorDisplayName)}&background=120F23&color=fff`;

      return {
        id: video.video_id,
        postId: video.post_id,
        title: video.caption?.substring(0, 100) || '',
        description: video.description || '',
        thumbnail: video.cover_url || '',
        videoUrl: video.video_url || '',
        platform: video.platform || (video.video_url ? detectPlatform(video.video_url) : 'unknown'), // Platform: tiktok, instagram, youtube, or unknown
        creator: {
          id: video.creator_id,
          username: creatorUsername,
          avatar: creatorAvatar,
          verified: creatorData?.verified || false
        },
        views: video.views_count || 0,
        likes: video.likes_count || 0,
        comments: video.comments_count || 0,
        shares: video.shares_count || 0,
        saves: video.collect_count || 0,
        impact: video.impact_score || 0,
        duration: video.duration_seconds || 0,
        createdAt: video.created_at,
        hashtags: hashtagsMap.get(video.video_id) || [],
        isEdit: video.is_edit
      };
    });

    return NextResponse.json({
      data: formattedData,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching community videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community videos' },
      { status: 500 }
    );
  }
}
