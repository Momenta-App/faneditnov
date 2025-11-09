import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'views';
    const editsOnly = searchParams.get('editsOnly') !== 'false'; // Default true

    // When editsOnly is false, we use pre-calculated totals from community_creator_memberships
    // When editsOnly is true, we need to recalculate based on filtered videos
    
    if (!editsOnly) {
      // Use pre-calculated totals (includes both edit and non-edit videos)
      const orderBy = sortBy === 'impact' ? 'total_impact_score' : 'total_views';
      
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('community_creator_memberships')
        .select('creator_id, total_views, total_impact_score, video_count')
        .eq('community_id', params.id)
        .gt('video_count', 0)
        .order(orderBy, { ascending: false })
        .limit(50);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const creatorIds = memberships.map(m => m.creator_id);
      const { data: creators, error: creatorError } = await supabaseAdmin
        .from('creators_hot')
        .select('creator_id, username, display_name, avatar_url, verified, bio')
        .in('creator_id', creatorIds);

      if (creatorError) throw creatorError;

      const creatorMap = new Map(memberships.map(m => [m.creator_id, m]));
      const formattedData = creators?.map(creator => {
        const membership = creatorMap.get(creator.creator_id);
        return {
          creator_id: creator.creator_id,
          username: creator.username || '',
          display_name: creator.display_name || '',
          avatar_url: creator.avatar_url || '',
          verified: creator.verified || false,
          bio: creator.bio || '',
          total_views: membership?.total_views || 0,
          total_impact_score: membership?.total_impact_score || 0,
          video_count: membership?.video_count || 0
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

      // Step 2: Get videos with creator info
      const { data: videos, error: videosError } = await supabaseAdmin
        .from('videos_hot')
        .select('creator_id, views_count, impact_score')
        .in('video_id', videoIds);

      if (videosError) throw videosError;

      // Step 3: Aggregate by creator
      const creatorStats = new Map<string, { total_views: number; total_impact: number; video_count: number }>();
      
      videos?.forEach(video => {
        if (!video.creator_id) return;
        
        const existing = creatorStats.get(video.creator_id) || { total_views: 0, total_impact: 0, video_count: 0 };
        existing.total_views += video.views_count || 0;
        existing.total_impact += video.impact_score || 0;
        existing.video_count += 1;
        creatorStats.set(video.creator_id, existing);
      });

      // Step 4: Sort and limit
      const sortedCreators = Array.from(creatorStats.entries())
        .sort((a, b) => {
          const aVal = sortBy === 'impact' ? a[1].total_impact : a[1].total_views;
          const bVal = sortBy === 'impact' ? b[1].total_impact : b[1].total_views;
          return bVal - aVal;
        })
        .slice(0, 50);

      if (sortedCreators.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // Step 5: Get creator details
      const creatorIds = sortedCreators.map(([creatorId]) => creatorId);
      const { data: creators, error: creatorsError } = await supabaseAdmin
        .from('creators_hot')
        .select('creator_id, username, display_name, avatar_url, verified, bio')
        .in('creator_id', creatorIds);

      if (creatorsError) throw creatorsError;

      // Step 6: Format response
      const formattedData = sortedCreators.map(([creatorId, stats]) => {
        const creator = creators?.find(c => c.creator_id === creatorId);
        return {
          creator_id: creatorId,
          username: creator?.username || '',
          display_name: creator?.display_name || '',
          avatar_url: creator?.avatar_url || '',
          verified: creator?.verified || false,
          bio: creator?.bio || '',
          total_views: stats.total_views,
          total_impact_score: stats.total_impact,
          video_count: stats.video_count
        };
      });

      return NextResponse.json({ data: formattedData });
    }
  } catch (error) {
    console.error('Error fetching community creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community creators' },
      { status: 500 }
    );
  }
}
