/**
 * User API route for refreshing submission stats
 * POST: Trigger stats refresh (enforce 24h limit)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/submissions/[id]/refresh-stats
 * Refresh stats for a submission (once per day limit)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Get submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check 24h limit using database function
    const { data: canRefresh, error: checkError } = await supabaseAdmin
      .rpc('can_refresh_stats', { p_submission_id: id });

    if (checkError) {
      console.error('Error checking refresh limit:', checkError);
      // Fallback to manual check
      if (submission.last_stats_refresh_at) {
        const lastRefresh = new Date(submission.last_stats_refresh_at);
        const now = new Date();
        const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);

        if (hoursSinceRefresh < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSinceRefresh);
          return NextResponse.json(
            { error: `Stats can only be refreshed once per day. Please wait ${hoursRemaining} more hour(s).` },
            { status: 400 }
          );
        }
      }
    } else if (canRefresh === false) {
      if (submission.last_stats_refresh_at) {
        const lastRefresh = new Date(submission.last_stats_refresh_at);
        const now = new Date();
        const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
        const hoursRemaining = Math.ceil(24 - hoursSinceRefresh);
        return NextResponse.json(
          { error: `Stats can only be refreshed once per day. Please wait ${hoursRemaining} more hour(s).` },
          { status: 400 }
        );
      }
    }

    // Update last refresh timestamp
    const { error: updateError } = await supabaseAdmin
      .from('contest_submissions')
      .update({
        last_stats_refresh_at: new Date().toISOString(),
        processing_status: 'fetching_stats',
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Trigger BrightData collection for stats refresh
    try {
      const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
      if (apiKey) {
        let datasetId: string | undefined;
        switch (submission.platform) {
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

        if (datasetId) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const webhookUrl = `${appUrl}/api/brightdata/contest-webhook`;
          const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&format=json&uncompressed_webhook=true&webhook_url=${encodeURIComponent(webhookUrl)}&include_errors=true`;

          await fetch(triggerUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([{ url: submission.original_video_url }]),
          });
        }
      }
    } catch (triggerError) {
      console.error('Error triggering BrightData refresh:', triggerError);
      // Don't fail the request if BrightData trigger fails
    }

    return NextResponse.json({
      success: true,
      message: 'Stats refresh initiated',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error refreshing stats:', error);
    return NextResponse.json(
      { error: 'Failed to refresh stats' },
      { status: 500 }
    );
  }
}

