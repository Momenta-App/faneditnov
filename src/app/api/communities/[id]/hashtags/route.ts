import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const editsOnly = searchParams.get('editsOnly') !== 'false'; // Default true

    // When editsOnly is false, use pre-calculated totals
    // When editsOnly is true, recalculate based on filtered videos
    
    if (!editsOnly) {
      // Use pre-calculated totals (includes both edit and non-edit videos)
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('community_hashtag_memberships')
        .select('hashtag, total_views, video_count')
        .eq('community_id', params.id)
        .gt('video_count', 0)
        .order('total_views', { ascending: false })
        .limit(50);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const hashtagNames = memberships.map(m => m.hashtag);
      const { data: hashtags, error: hashtagError } = await supabaseAdmin
        .from('hashtags_hot')
        .select('hashtag, hashtag_norm, views_total, videos_count')
        .in('hashtag', hashtagNames);

      if (hashtagError) throw hashtagError;

      const hashtagMap = new Map(memberships.map(m => [m.hashtag, m]));
      const formattedData = hashtags?.map(hashtag => {
        const membership = hashtagMap.get(hashtag.hashtag);
        return {
          hashtag: hashtag.hashtag,
          hashtag_norm: hashtag.hashtag_norm,
          total_views: membership?.total_views || 0,
          video_count: membership?.video_count || 0,
          global_views: hashtag.views_total || 0,
          global_videos: hashtag.videos_count || 0
        };
      }) || [];

      return NextResponse.json({ data: formattedData });
    } else {
      // Recalculate based only on edit videos
      // Step 1: Get edit video memberships for this community
      const { data: videoMemberships, error: vmError } = await supabaseAdmin
        .from('community_video_memberships')
        .select('video_id')
        .eq('community_id', params.id)
        .eq('is_edit_video', true);

      if (vmError) throw vmError;

      if (!videoMemberships || videoMemberships.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const videoIds = videoMemberships.map(vm => vm.video_id);

      // Step 2: Get hashtags from video_hashtag_facts
      const { data: videoHashtags, error: vhError } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('hashtag, video_id, views_at_snapshot')
        .in('video_id', videoIds);

      if (vhError) throw vhError;

      // Step 3: Get video views for accurate counts
      const { data: videos, error: videosError } = await supabaseAdmin
        .from('videos_hot')
        .select('video_id, views_count')
        .in('video_id', videoIds);

      if (videosError) throw videosError;

      const videoViewsMap = new Map(videos?.map(v => [v.video_id, v.views_count]) || []);

      // Step 4: Aggregate by hashtag
      const hashtagStats = new Map<string, { total_views: number; video_count: number }>();
      
      videoHashtags?.forEach(vh => {
        const existing = hashtagStats.get(vh.hashtag) || { total_views: 0, video_count: 0 };
        const views = videoViewsMap.get(vh.video_id) || 0;
        existing.total_views += views;
        existing.video_count += 1;
        hashtagStats.set(vh.hashtag, existing);
      });

      // Step 5: Get community's linked hashtags to filter
      const { data: community } = await supabaseAdmin
        .from('communities')
        .select('linked_hashtags')
        .eq('id', params.id)
        .single();

      const linkedHashtags = community?.linked_hashtags || [];

      // Filter to only linked hashtags
      const filteredStats = Array.from(hashtagStats.entries())
        .filter(([hashtag]) => linkedHashtags.includes(hashtag))
        .sort((a, b) => b[1].total_views - a[1].total_views)
        .slice(0, 50);

      if (filteredStats.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // Step 6: Get hashtag details
      const hashtagNames = filteredStats.map(([hashtag]) => hashtag);
      const { data: hashtags } = await supabaseAdmin
        .from('hashtags_hot')
        .select('hashtag, hashtag_norm, views_total, videos_count')
        .in('hashtag', hashtagNames);

      // Step 7: Format response
      const formattedData = filteredStats.map(([hashtag, stats]) => {
        const hashtagDetails = hashtags?.find(h => h.hashtag === hashtag);
        return {
          hashtag,
          hashtag_norm: hashtagDetails?.hashtag_norm || hashtag,
          total_views: stats.total_views,
          video_count: stats.video_count,
          global_views: hashtagDetails?.views_total || 0,
          global_videos: hashtagDetails?.videos_count || 0
        };
      });

      return NextResponse.json({ data: formattedData });
    }
  } catch (error) {
    console.error('Error fetching community hashtags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community hashtags' },
      { status: 500 }
    );
  }
}
