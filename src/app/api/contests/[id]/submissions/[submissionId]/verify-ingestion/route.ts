/**
 * Verification endpoint for contest submission ingestion
 * GET: Check if contest submission made it to videos_hot and other main tables
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contests/[id]/submissions/[submissionId]/verify-ingestion
 * Verify that a contest submission was properly ingested into main database tables
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: contestId, submissionId } = await params;

    // Get the contest submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .select('*')
      .eq('id', submissionId)
      .eq('contest_id', contestId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Try to find video in videos_hot by URL or video_id
    let videoHot = null;
    const videoUrl = submission.original_video_url;
    
    if (videoUrl) {
      const { data: foundVideo } = await supabaseAdmin
        .from('videos_hot')
        .select('id, video_id, video_url, url, views_count, likes_count')
        .or(`url.eq.${videoUrl},video_url.eq.${videoUrl}${submission.video_id ? `,video_id.eq.${submission.video_id},post_id.eq.${submission.video_id}` : ''}`)
        .maybeSingle();
      videoHot = foundVideo;
    }
    
    if (!videoHot && videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video not found in videos_hot - ingestion may not have completed yet',
        submission: {
          id: submission.id,
          original_video_url: submission.original_video_url,
          status: submission.processing_status,
        }
      });
    }

    // Check creators_hot
    let creatorHot = null;
    if (submission.creator_id) {
      const { data: creator } = await supabaseAdmin
        .from('creators_hot')
        .select('id, creator_id, username, videos_count')
        .eq('creator_id', submission.creator_id)
        .maybeSingle();
      creatorHot = creator;
    }

    // Check hashtags_hot (if submission has hashtags)
    let hashtagsHot: any[] = [];
    if (submission.hashtags_array && Array.isArray(submission.hashtags_array)) {
      const hashtagNames = submission.hashtags_array
        .map((h: string) => h.replace('#', '').toLowerCase())
        .filter(Boolean);
      
      if (hashtagNames.length > 0) {
        const { data: hashtags } = await supabaseAdmin
          .from('hashtags_hot')
          .select('id, hashtag, videos_count')
          .in('hashtag', hashtagNames);
        hashtagsHot = hashtags || [];
      }
    }

    // Check video_hashtag_facts (relationship table)
    let videoHashtagFacts: any[] = [];
    if (videoHot) {
      const { data: facts } = await supabaseAdmin
        .from('video_hashtag_facts')
        .select('hashtag, video_id')
        .eq('video_id', videoHot.video_id)
        .limit(10);
      videoHashtagFacts = facts || [];
    }

    // Check storage bucket for images
    let videoCoverExists = false;
    let creatorAvatarExists = false;
    
    if (videoHot?.video_id) {
      const { data: videoCoverFiles } = await supabaseAdmin
        .storage
        .from('brightdata-results')
        .list('video-cover', {
          search: videoHot.video_id
        });
      videoCoverExists = (videoCoverFiles?.length || 0) > 0;
    }

    if (creatorHot?.creator_id) {
      const { data: avatarFiles } = await supabaseAdmin
        .storage
        .from('brightdata-results')
        .list('creator-avatar', {
          search: creatorHot.creator_id
        });
      creatorAvatarExists = (avatarFiles?.length || 0) > 0;
    }

    // Check bd_ingestions for ingestion status
    let ingestionStatus = null;
    if (submission.snapshot_id) {
      const { data: ingestion } = await supabaseAdmin
        .from('bd_ingestions')
        .select('status, error, raw_count, created_at, updated_at')
        .eq('snapshot_id', submission.snapshot_id)
        .maybeSingle();
      ingestionStatus = ingestion;
    }

    // Overall status
    const allChecks = {
      videoInVideosHot: !!videoHot,
      creatorInCreatorsHot: !!creatorHot,
      hashtagsInHashtagsHot: hashtagsHot.length > 0,
      videoHashtagFactsExist: videoHashtagFacts.length > 0,
      videoCoverInStorage: videoCoverExists,
      creatorAvatarInStorage: creatorAvatarExists,
      ingestionLogged: !!ingestionStatus,
    };

    const allPassed = Object.values(allChecks).every(Boolean);
    const criticalChecks = {
      videoInVideosHot: allChecks.videoInVideosHot,
      creatorInCreatorsHot: allChecks.creatorInCreatorsHot,
      ingestionLogged: allChecks.ingestionLogged,
    };
    const criticalPassed = Object.values(criticalChecks).every(Boolean);

    return NextResponse.json({
      success: allPassed,
      criticalSuccess: criticalPassed,
      submission: {
        id: submission.id,
        original_video_url: submission.original_video_url,
        videoUrl: videoHot?.video_url || videoHot?.url || submission.original_video_url,
        snapshotId: submission.snapshot_id,
        processingStatus: submission.processing_status,
        createdAt: submission.created_at,
      },
      checks: allChecks,
      details: {
        videoHot: videoHot ? {
          videoId: videoHot.video_id,
          videoUrl: videoHot.video_url || videoHot.url,
          views: videoHot.views_count,
          likes: videoHot.likes_count,
        } : null,
        creatorHot: creatorHot ? {
          id: creatorHot.id,
          creatorId: creatorHot.creator_id,
          username: creatorHot.username,
          videosCount: creatorHot.videos_count,
        } : null,
        hashtagsHot: hashtagsHot.map(h => ({
          id: h.id,
          hashtag: h.hashtag,
          videosCount: h.videos_count,
        })),
        videoHashtagFacts: videoHashtagFacts.map(f => ({
          hashtag: f.hashtag,
          videoId: f.video_id,
        })),
        ingestionStatus: ingestionStatus ? {
          status: ingestionStatus.status,
          error: ingestionStatus.error,
          rawCount: ingestionStatus.raw_count,
          createdAt: ingestionStatus.created_at,
          updatedAt: ingestionStatus.updated_at,
        } : null,
      },
      recommendations: !allPassed ? [
        !allChecks.videoInVideosHot && 'Video not found in videos_hot - ingestion may have failed',
        !allChecks.creatorInCreatorsHot && 'Creator not found in creators_hot - ingestion may have failed',
        !allChecks.hashtagsInHashtagsHot && submission.hashtags_array?.length > 0 && 'Hashtags not found in hashtags_hot',
        !allChecks.videoCoverInStorage && 'Video cover image not found in storage bucket',
        !allChecks.creatorAvatarInStorage && 'Creator avatar not found in storage bucket',
        !allChecks.ingestionLogged && 'Ingestion not logged in bd_ingestions table',
      ].filter(Boolean) : [],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('auth')) {
      return handleAuthError(error);
    }
    console.error('[Verify Ingestion] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

