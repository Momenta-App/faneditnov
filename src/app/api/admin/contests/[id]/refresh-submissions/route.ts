/**
 * Admin API route to refresh all contest submissions
 * Triggers BrightData collection for all submissions in a contest
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

type Platform = 'tiktok' | 'instagram' | 'youtube';

/**
 * POST /api/admin/contests/[id]/refresh-submissions
 * Trigger BrightData refresh for all submissions in a contest
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId } = await params;

    console.log('[Refresh Submissions] Starting refresh for contest:', {
      contestId,
      userId: user.id,
    });

    // Get all submissions for this contest
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, original_video_url, platform, snapshot_id')
      .eq('contest_id', contestId);

    if (submissionsError) {
      console.error('[Refresh Submissions] Error fetching submissions:', submissionsError);
      return NextResponse.json(
        { error: 'Failed to fetch submissions', details: submissionsError.message },
        { status: 500 }
      );
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No submissions found for this contest',
        queued: 0,
        total: 0,
      });
    }

    console.log('[Refresh Submissions] Found submissions:', {
      contestId,
      count: submissions.length,
    });

    // Trigger BrightData for each submission
    const results = {
      queued: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const submission of submissions) {
      try {
        const platform = (submission.platform || detectPlatform(submission.original_video_url)) as Platform;
        
        if (!platform || platform === 'unknown') {
          results.failed++;
          results.errors.push(`Submission ${submission.id}: Unknown platform`);
          continue;
        }

        // Trigger BrightData collection
        const snapshotId = await triggerBrightDataCollection(
          platform,
          submission.original_video_url,
          submission.id
        );

        if (snapshotId) {
          // Update submission with new snapshot_id
          await supabaseAdmin
            .from('contest_submissions')
            .update({ snapshot_id: snapshotId })
            .eq('id', submission.id);

          results.queued++;
          console.log('[Refresh Submissions] Queued submission:', {
            submissionId: submission.id,
            snapshotId,
            platform,
          });
        } else {
          results.failed++;
          results.errors.push(`Submission ${submission.id}: Failed to get snapshot_id`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Submission ${submission.id}: ${errorMessage}`);
        console.error('[Refresh Submissions] Error processing submission:', {
          submissionId: submission.id,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${results.queued} submissions, ${results.failed} failed`,
      queued: results.queued,
      failed: results.failed,
      total: submissions.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Refresh Submissions] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh submissions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Trigger BrightData collection for video stats
 * Uses contest-webhook endpoint to update contest submissions
 */
async function triggerBrightDataCollection(
  platform: Platform,
  url: string,
  submissionId: number
): Promise<string | null> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.warn('[Refresh Submissions] BRIGHT_DATA_API_KEY not configured');
    return null;
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
    console.warn(`[Refresh Submissions] Dataset ID not configured for ${platform}`);
    return null;
  }

  // Get webhook URL
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      appUrl = 'http://localhost:3000';
    }
  }

  // Ensure URL has protocol
  if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    appUrl = `https://${appUrl}`;
  }

  // Legacy domain redirects
  if (appUrl === 'https://sportsclips.io' || appUrl === 'https://sportsclips.io/') {
    appUrl = 'https://www.sportsclips.io';
  }

  if (
    appUrl === 'https://fanedit.com' ||
    appUrl === 'https://fanedit.com/' ||
    appUrl === 'https://www.fanedit.com' ||
    appUrl === 'https://www.fanedit.com/'
  ) {
    appUrl = 'https://www.sportsclips.io';
  }

  // Remove trailing slashes
  appUrl = appUrl.replace(/\/+$/, '');

  const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/contest-webhook`);

  // Trigger BrightData collection
  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  console.log('[Refresh Submissions] BrightData trigger details:', {
    submissionId,
    platform,
    datasetId,
    webhookUrl: `${appUrl}/api/brightdata/contest-webhook`,
  });

  // Use same payload format as upload flow
  const requestBody = [{ url }];

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
      console.error(`[Refresh Submissions] BrightData trigger failed: ${errorBody}`);
      throw new Error(`BrightData trigger failed: ${errorBody}`);
    }

    const triggerData = await response.json();
    console.log('[Refresh Submissions] BrightData trigger response:', {
      submissionId,
      response: JSON.stringify(triggerData, null, 2),
    });

    // Extract snapshot ID
    let snapshotId: string | undefined;
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      const firstItem = triggerData[0];
      snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
    } else if (triggerData && typeof triggerData === 'object') {
      snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
    }

    if (!snapshotId) {
      console.warn('[Refresh Submissions] No snapshot_id found in response, generating UUID');
      return crypto.randomUUID();
    }

    return snapshotId;
  } catch (error) {
    console.error('[Refresh Submissions] Error triggering BrightData:', error);
    throw error;
  }
}

