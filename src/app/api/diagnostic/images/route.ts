import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isSupabaseUrl } from '@/lib/image-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/diagnostic/images
 * Diagnostic endpoint to check image storage status
 */
export async function GET(request: NextRequest) {
  try {
    // Check recent videos
    const { data: videos, error: videosError } = await supabaseAdmin!
      .from('videos_hot')
      .select('video_id, cover_url, platform, created_at')
      .not('cover_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (videosError) {
      return NextResponse.json(
        { error: 'Failed to fetch videos', details: videosError.message },
        { status: 500 }
      );
    }

    // Check recent creators
    const { data: creators, error: creatorsError } = await supabaseAdmin!
      .from('creators_hot')
      .select('creator_id, avatar_url, username')
      .not('avatar_url', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (creatorsError) {
      return NextResponse.json(
        { error: 'Failed to fetch creators', details: creatorsError.message },
        { status: 500 }
      );
    }

    // Analyze URLs
    const videoAnalysis = {
      total: videos?.length || 0,
      supabaseUrls: videos?.filter(v => isSupabaseUrl(v.cover_url || '')).length || 0,
      externalUrls: videos?.filter(v => v.cover_url && !isSupabaseUrl(v.cover_url || '')).length || 0,
      samples: videos?.slice(0, 5).map(v => ({
        video_id: v.video_id,
        platform: v.platform,
        cover_url: v.cover_url,
        isSupabaseUrl: isSupabaseUrl(v.cover_url || ''),
        urlPreview: v.cover_url ? v.cover_url.substring(0, 100) : null
      })) || []
    };

    const creatorAnalysis = {
      total: creators?.length || 0,
      supabaseUrls: creators?.filter(c => isSupabaseUrl(c.avatar_url || '')).length || 0,
      externalUrls: creators?.filter(c => c.avatar_url && !isSupabaseUrl(c.avatar_url || '')).length || 0,
      samples: creators?.slice(0, 5).map(c => ({
        creator_id: c.creator_id,
        username: c.username,
        avatar_url: c.avatar_url,
        isSupabaseUrl: isSupabaseUrl(c.avatar_url || ''),
        urlPreview: c.avatar_url ? c.avatar_url.substring(0, 100) : null
      })) || []
    };

    // Check storage bucket
    const { data: buckets, error: bucketError } = await supabaseAdmin!
      .storage
      .listBuckets();

    const storageBucket = buckets?.find(b => b.id === 'brightdata-results');

    return NextResponse.json({
      success: true,
      data: {
        videos: videoAnalysis,
        creators: creatorAnalysis,
        storage: {
          bucketExists: !!storageBucket,
          bucketPublic: storageBucket?.public || false,
          bucketName: storageBucket?.id || 'not found'
        },
        summary: {
          videosUsingSupabase: `${videoAnalysis.supabaseUrls}/${videoAnalysis.total}`,
          creatorsUsingSupabase: `${creatorAnalysis.supabaseUrls}/${creatorAnalysis.total}`,
          needsMigration: videoAnalysis.externalUrls > 0 || creatorAnalysis.externalUrls > 0
        }
      }
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

