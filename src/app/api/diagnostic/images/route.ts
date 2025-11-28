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

    // List files in the bucket to verify structure
    let bucketFiles: any = null;
    let bucketFolders: any = null;
    let bucketErrorDetails: string | null = null;

    if (storageBucket) {
      try {
        // List root level to see folders
        const { data: rootFiles, error: rootError } = await supabaseAdmin!
          .storage
          .from('brightdata-results')
          .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

        if (rootError) {
          bucketErrorDetails = rootError.message;
        } else {
          bucketFiles = rootFiles || [];
          // Separate folders from files
          bucketFolders = bucketFiles.filter((f: any) => !f.id); // Folders don't have id
          bucketFiles = bucketFiles.filter((f: any) => f.id); // Files have id
        }

        // Check specific folders
        const { data: videoCoverFiles } = await supabaseAdmin!
          .storage
          .from('brightdata-results')
          .list('video-cover', { limit: 10 });

        const { data: creatorAvatarFiles } = await supabaseAdmin!
          .storage
          .from('brightdata-results')
          .list('creator-avatar', { limit: 10 });

        return NextResponse.json({
          success: true,
          data: {
            videos: videoAnalysis,
            creators: creatorAnalysis,
            storage: {
              bucketExists: !!storageBucket,
              bucketPublic: storageBucket?.public || false,
              bucketName: storageBucket?.id || 'not found',
              bucketError: bucketErrorDetails,
              rootFiles: bucketFiles?.length || 0,
              rootFolders: bucketFolders?.map((f: any) => f.name) || [],
              videoCoverFiles: videoCoverFiles?.length || 0,
              videoCoverSamples: videoCoverFiles?.slice(0, 5).map((f: any) => ({
                name: f.name,
                size: f.metadata?.size,
                updated: f.updated_at
              })) || [],
              creatorAvatarFiles: creatorAvatarFiles?.length || 0,
              creatorAvatarSamples: creatorAvatarFiles?.slice(0, 5).map((f: any) => ({
                name: f.name,
                size: f.metadata?.size,
                updated: f.updated_at
              })) || []
            },
            summary: {
              videosUsingSupabase: `${videoAnalysis.supabaseUrls}/${videoAnalysis.total}`,
              creatorsUsingSupabase: `${creatorAnalysis.supabaseUrls}/${creatorAnalysis.total}`,
              needsMigration: videoAnalysis.externalUrls > 0 || creatorAnalysis.externalUrls > 0
            }
          }
        });
      } catch (listError) {
        bucketErrorDetails = listError instanceof Error ? listError.message : 'Unknown error listing files';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        videos: videoAnalysis,
        creators: creatorAnalysis,
        storage: {
          bucketExists: !!storageBucket,
          bucketPublic: storageBucket?.public || false,
          bucketName: storageBucket?.id || 'not found',
          bucketError: bucketErrorDetails || bucketError?.message || null
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

