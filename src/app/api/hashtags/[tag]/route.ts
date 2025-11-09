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

    // Try to get the hashtag from hashtags_hot table
    const { data: hashtagData, error: hashtagError } = await supabaseAdmin
      .from('hashtags_hot')
      .select('hashtag, hashtag_norm, views_total, videos_count, creators_count')
      .eq('hashtag', normalizedTag)
      .single();

    if (hashtagError && hashtagError.code !== 'PGRST116') {
      // PGRST116 is "not found", which is ok - we'll compute stats
      console.error('Error fetching hashtag:', hashtagError);
      return NextResponse.json({ error: hashtagError.message }, { status: 500 });
    }

    // If hashtag exists in hashtags_hot, return it
    if (hashtagData) {
      return NextResponse.json({
        data: {
          id: hashtagData.hashtag,
          name: hashtagData.hashtag_norm || hashtagData.hashtag,
          views: hashtagData.views_total || 0,
          videos: hashtagData.videos_count || 0,
          creators: hashtagData.creators_count || 0,
          impact: 0, // We can calculate this if needed
          trending: false,
          description: `${hashtagData.videos_count || 0} videos by ${hashtagData.creators_count || 0} creators`,
        }
      });
    }

    // If not found in hashtags_hot, compute stats from video_hashtag_facts
    const { data: videoHashtags, error: videoHashtagError } = await supabaseAdmin
      .from('video_hashtag_facts')
      .select('video_id')
      .eq('hashtag', normalizedTag);

    if (videoHashtagError) {
      console.error('Error fetching video hashtags:', videoHashtagError);
      return NextResponse.json({ error: videoHashtagError.message }, { status: 500 });
    }

    const videoIds = videoHashtags?.map(v => v.video_id) || [];

    if (videoIds.length === 0) {
      // Hashtag has no videos
      return NextResponse.json({
        data: {
          id: normalizedTag,
          name: normalizedTag,
          views: 0,
          videos: 0,
          creators: 0,
          impact: 0,
          trending: false,
          description: '0 videos by 0 creators',
        }
      });
    }

    // Get video stats
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos_hot')
      .select('video_id, views_count, creator_id')
      .in('video_id', videoIds);

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json({ error: videosError.message }, { status: 500 });
    }

    // Calculate stats
    const totalViews = videos?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
    const uniqueCreators = new Set(videos?.map(v => v.creator_id) || []).size;

    return NextResponse.json({
      data: {
        id: normalizedTag,
        name: normalizedTag,
        views: totalViews,
        videos: videoIds.length,
        creators: uniqueCreators,
        impact: 0,
        trending: false,
        description: `${videoIds.length} videos by ${uniqueCreators} creators`,
      }
    });
  } catch (error) {
    console.error('Error in hashtag API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

