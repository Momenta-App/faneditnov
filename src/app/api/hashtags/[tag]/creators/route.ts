import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { tag: string } }
) {
  try {
    // Normalize hashtag: remove #, lowercase, trim
    const tag = decodeURIComponent(params.tag);
    const normalizedTag = tag.toLowerCase().replace(/^#/, '').trim();

    // Use raw SQL to efficiently aggregate creator data
    const { data, error } = await supabaseAdmin.rpc('get_hashtag_creators', {
      p_hashtag: normalizedTag
    });

    if (error) {
      console.error('Error calling get_hashtag_creators function:', error);
      
      // Fallback to manual query if function doesn't exist
      console.log('Falling back to manual aggregation...');
      return await getHashtagCreatorsFallback(normalizedTag);
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map((creator: any) => ({
      creator_id: creator.creator_id,
      username: creator.username,
      display_name: creator.display_name || creator.username,
      avatar_url: creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name || creator.username)}&background=120F23&color=fff`,
      verified: creator.verified || false,
      bio: creator.bio || '',
      total_views: creator.total_views || 0,
      video_count: creator.video_count || 0,
    })) || [];

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Error in hashtag creators API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fallback method using JavaScript aggregation
async function getHashtagCreatorsFallback(normalizedTag: string) {
  try {
    // Get all video IDs for this hashtag
    const { data: hashtagVideos, error: hashtagError } = await supabaseAdmin
      .from('video_hashtag_facts')
      .select('video_id')
      .eq('hashtag', normalizedTag);

    if (hashtagError) {
      throw hashtagError;
    }

    const videoIds = hashtagVideos?.map((v) => v.video_id) || [];

    if (videoIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get videos with creator info
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select(`
        video_id,
        creator_id,
        views_count,
        creator:creators_hot!videos_hot_creator_id_fkey(
          creator_id,
          username,
          display_name,
          avatar_url,
          verified,
          bio
        )
      `)
      .in('video_id', videoIds);

    if (videosError) {
      throw videosError;
    }

    // Aggregate by creator
    const creatorMap = new Map<string, any>();

    videos?.forEach((video: any) => {
      const creatorId = video.creator_id;
      
      if (!creatorMap.has(creatorId)) {
        creatorMap.set(creatorId, {
          creator_id: creatorId,
          username: video.creator?.username,
          display_name: video.creator?.display_name || video.creator?.username,
          avatar_url: video.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator?.display_name || video.creator?.username || 'User')}&background=120F23&color=fff`,
          verified: video.creator?.verified || false,
          bio: video.creator?.bio || '',
          total_views: 0,
          video_count: 0,
        });
      }

      const creatorData = creatorMap.get(creatorId);
      creatorData.total_views += video.views_count || 0;
      creatorData.video_count += 1;
    });

    // Convert to array and sort by total views
    const transformedData = Array.from(creatorMap.values())
      .sort((a, b) => b.total_views - a.total_views)
      .slice(0, 15); // Top 15

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Fallback query error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

