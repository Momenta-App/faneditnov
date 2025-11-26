/**
 * Background processing route for contest submissions
 * Processes submissions: fetches stats, performs checks, calculates impact
 * Can be called after submission creation or manually
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

type Platform = 'tiktok' | 'instagram' | 'youtube';

/**
 * POST /api/contests/process-submission
 * Process a submission: fetch stats, check hashtags/description, calculate impact
 */
export async function POST(request: NextRequest) {
  try {
    const { submissionId } = await request.json();

    if (!submissionId) {
      console.error('[Process Submission] Missing submissionId');
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    console.log('[Process Submission] Starting processing for submission:', submissionId);

    // Get submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        contests:contest_id (
          id,
          required_hashtags,
          required_description_template
        )
      `)
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      console.error('[Process Submission] Submission not found:', {
        submissionId,
        error: submissionError?.message,
      });
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const contest = submission.contests as any;
    console.log('[Process Submission] Submission found:', {
      submissionId,
      contestId: submission.contest_id,
      platform: submission.platform,
      videoUrl: submission.original_video_url,
    });

    // Step 1: Update status to fetching_stats
    await supabaseAdmin
      .from('contest_submissions')
      .update({ processing_status: 'fetching_stats' })
      .eq('id', submissionId);
    
    console.log('[Process Submission] Status updated to fetching_stats');

    // Step 2: Trigger BrightData stats retrieval
    // This will be handled by the webhook when data arrives
    try {
      const snapshotId = await triggerBrightDataCollection(
        submission.platform as Platform,
        submission.original_video_url
      );

      // Store snapshot_id in submission for webhook matching
      await supabaseAdmin
        .from('contest_submissions')
        .update({ snapshot_id: snapshotId })
        .eq('id', submissionId);

      console.log('[Process Submission] Snapshot ID stored:', { submissionId, snapshotId });

      return NextResponse.json({
        success: true,
        message: 'Processing initiated',
        snapshot_id: snapshotId,
      });
    } catch (brightDataError) {
      // If BrightData trigger fails, mark submission as needing manual review
      const errorMessage = brightDataError instanceof Error ? brightDataError.message : 'Unknown error';
      console.error('[Process Submission] BrightData trigger failed:', {
        submissionId,
        error: errorMessage,
        stack: brightDataError instanceof Error ? brightDataError.stack : undefined,
      });
      
      await supabaseAdmin
        .from('contest_submissions')
        .update({
          processing_status: 'waiting_review',
          invalid_stats_flag: true,
        })
        .eq('id', submissionId);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to trigger stats collection. Submission marked for manual review.',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Process Submission] Unexpected error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Failed to process submission',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Trigger BrightData collection for video stats
 */
async function triggerBrightDataCollection(
  platform: Platform,
  url: string
): Promise<string> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.warn('[Process Submission] BRIGHT_DATA_API_KEY not configured');
    return crypto.randomUUID();
  }

  // Get dataset ID for platform
  let datasetId: string | undefined;
  switch (platform) {
    case 'tiktok':
      datasetId = process.env.BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID;
      break;
    case 'instagram':
      datasetId = process.env.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID;
      break;
    case 'youtube':
      datasetId = process.env.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID;
      break;
  }

  if (!datasetId) {
    console.warn(`[Process Submission] Dataset ID not configured for ${platform}`);
    return crypto.randomUUID();
  }

  // Get webhook URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const webhookUrl = `${appUrl}/api/brightdata/contest-webhook`;

  // Trigger BrightData collection
  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&format=json&uncompressed_webhook=true&webhook_url=${encodeURIComponent(webhookUrl)}&include_errors=true`;

  const requestBody = [{ url, country: '' }];

  try {
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Process Submission] BrightData trigger failed: ${errorBody}`);
      throw new Error(`BrightData trigger failed: ${errorBody}`);
    }

    const triggerData = await response.json();

    // Extract snapshot ID
    let snapshotId: string | undefined;
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      const firstItem = triggerData[0];
      snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
    } else if (triggerData && typeof triggerData === 'object') {
      snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
    }

    return snapshotId || crypto.randomUUID();
  } catch (error) {
    console.error('[Process Submission] Error triggering BrightData:', error);
    throw error;
  }
}

