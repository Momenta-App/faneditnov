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

    // Step 2: Check if BrightData was already triggered by submission route
    // First, check if there's a metadata entry linked via raw_video_assets (most reliable)
    const { data: rawAsset } = await supabaseAdmin
      .from('raw_video_assets')
      .select('id, submission_metadata_id')
      .eq('contest_submission_id', submissionId)
      .maybeSingle();

    let metadataRecord: { snapshot_id: string; created_at: string } | null = null;
    
    if (rawAsset?.submission_metadata_id) {
      // Found metadata linked via raw_video_assets - this is the one created during submission
      const { data: metadata } = await supabaseAdmin
        .from('submission_metadata')
        .select('snapshot_id, created_at')
        .eq('snapshot_id', rawAsset.submission_metadata_id)
        .maybeSingle();
      
      if (metadata) {
        metadataRecord = metadata;
        console.log('[Process Submission] Found metadata via raw_video_assets:', {
          submissionId,
          snapshotId: metadata.snapshot_id,
        });
      }
    }

    // Fallback: Check for recent metadata by user and URL (within last 2 minutes)
    if (!metadataRecord) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentMetadata } = await supabaseAdmin
        .from('submission_metadata')
        .select('snapshot_id, created_at')
        .eq('submitted_by', submission.user_id)
        .contains('video_urls', [submission.original_video_url])
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentMetadata) {
        metadataRecord = recentMetadata;
        console.log('[Process Submission] Found recent metadata by URL match:', {
          submissionId,
          snapshotId: recentMetadata.snapshot_id,
        });
      }
    }

    let snapshotId: string;

    try {
      if (metadataRecord) {
        // Found metadata entry - check if it's a placeholder or actual snapshot_id
        const isPlaceholder = metadataRecord.snapshot_id.startsWith('pending_') || metadataRecord.snapshot_id.startsWith('mock_');
        
        if (isPlaceholder) {
          // Placeholder found - submission creation route created metadata but didn't trigger BrightData
          // We need to trigger BrightData and update the placeholder with the actual snapshot_id
          console.log('[Process Submission] Found placeholder snapshot_id - triggering BrightData for contest webhook:', {
            submissionId,
            placeholderSnapshotId: metadataRecord.snapshot_id,
          });
          
          snapshotId = await triggerBrightDataCollection(
            submission.platform as Platform,
            submission.original_video_url
          );

          // Update the placeholder with actual snapshot_id
          await supabaseAdmin
            .from('submission_metadata')
            .update({ 
              snapshot_id: snapshotId,
              contest_submission_id: submissionId,
            })
            .eq('snapshot_id', metadataRecord.snapshot_id);

          // Also update raw_video_assets if it exists and links to the old placeholder
          if (rawAsset && rawAsset.submission_metadata_id === metadataRecord.snapshot_id) {
            await supabaseAdmin
              .from('raw_video_assets')
              .update({ submission_metadata_id: snapshotId })
              .eq('id', rawAsset.id);
          }
        } else {
          // Actual snapshot_id found - BrightData was already triggered (shouldn't happen for new submissions)
          snapshotId = metadataRecord.snapshot_id;
          console.log('[Process Submission] Found existing snapshot_id (unexpected for new submission):', {
            submissionId,
            snapshotId,
            note: 'Reusing existing snapshot_id',
          });
          
          // Update metadata to link to this submission if not already linked
          await supabaseAdmin
            .from('submission_metadata')
            .update({ contest_submission_id: submissionId })
            .eq('snapshot_id', snapshotId);
        }
      } else {
        // No metadata found - trigger BrightData for contest webhook
        console.log('[Process Submission] No existing metadata found - triggering BrightData for contest webhook:', {
          submissionId,
        });
        
        snapshotId = await triggerBrightDataCollection(
          submission.platform as Platform,
          submission.original_video_url
        );

        // Create submission_metadata entry for this trigger
        await supabaseAdmin
          .from('submission_metadata')
          .upsert({
            snapshot_id: snapshotId,
            video_urls: [submission.original_video_url],
            skip_validation: false,
            submitted_by: submission.user_id,
            contest_submission_id: submissionId,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'snapshot_id',
            ignoreDuplicates: false
          });
      }

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

  // Get webhook URL - use NEXT_PUBLIC_APP_URL (e.g., https://faneditnov.vercel.app)
  // This should be set in environment variables and can change per deployment
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    // Fallback to VERCEL_URL if available (for Vercel deployments)
    if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      // Default to localhost for local development
      appUrl = 'http://localhost:3000';
    }
  }

  // Ensure URL has protocol
  if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    appUrl = `https://${appUrl}`;
  }

  // Legacy domain redirects (can be removed if not needed)
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

  // Trigger BrightData collection - use endpoint and notify parameters like the upload flow
  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

  console.log('[Process Submission] BrightData trigger details:', {
    platform,
    datasetId,
    webhookUrl: `${appUrl}/api/brightdata/contest-webhook`,
    triggerUrl: triggerUrl.substring(0, 200) + '...',
  });

  // Use same payload format as upload flow - just { url }, no country field
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
      console.error(`[Process Submission] BrightData trigger failed: ${errorBody}`);
      throw new Error(`BrightData trigger failed: ${errorBody}`);
    }

    const triggerData = await response.json();
    console.log('[Process Submission] BrightData trigger response:', JSON.stringify(triggerData, null, 2));

    // Extract snapshot ID
    let snapshotId: string | undefined;
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      const firstItem = triggerData[0];
      snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
      console.log('[Process Submission] Extracted snapshot_id from array:', snapshotId);
    } else if (triggerData && typeof triggerData === 'object') {
      snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
      console.log('[Process Submission] Extracted snapshot_id from object:', snapshotId);
    }

    if (!snapshotId) {
      console.warn('[Process Submission] No snapshot_id found in response, generating UUID');
    }

    return snapshotId || crypto.randomUUID();
  } catch (error) {
    console.error('[Process Submission] Error triggering BrightData:', error);
    throw error;
  }
}

