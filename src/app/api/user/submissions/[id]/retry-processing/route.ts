/**
 * User API route for retrying failed submission processing
 * POST: Retry BrightData processing for a submission that failed
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/submissions/[id]/retry-processing
 * Retry processing for a submission that failed BrightData collection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Get submission and verify ownership
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

    // Check if submission is in a state that can be retried
    // Allow retry if: invalid_stats_flag is true, or processing_status indicates failure
    const canRetry = 
      submission.invalid_stats_flag === true ||
      submission.processing_status === 'waiting_review' ||
      submission.processing_status === 'uploaded';

    if (!canRetry && submission.processing_status === 'approved') {
      return NextResponse.json(
        { error: 'Submission is already approved and cannot be retried' },
        { status: 400 }
      );
    }

    // Clear invalid_stats_flag and reset processing status
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        invalid_stats_flag: false,
        processing_status: 'uploaded',
      })
      .eq('id', id);

    // Call the process-submission endpoint internally
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const processUrl = `${appUrl}/api/contests/process-submission`;

    try {
      const processResponse = await fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submissionId: id }),
      });

      const processData = await processResponse.json();

      if (!processResponse.ok) {
        // If processing fails, restore the invalid flag
        await supabaseAdmin
          .from('contest_submissions')
          .update({
            invalid_stats_flag: true,
            processing_status: 'waiting_review',
          })
          .eq('id', id);

        return NextResponse.json(
          {
            error: processData.error || 'Failed to retry processing',
            details: processData.details,
          },
          { status: processResponse.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Processing retry initiated. This may take a few minutes.',
        snapshot_id: processData.snapshot_id,
      });
    } catch (fetchError) {
      // If fetch fails, restore the invalid flag
      await supabaseAdmin
        .from('contest_submissions')
        .update({
          invalid_stats_flag: true,
          processing_status: 'waiting_review',
        })
        .eq('id', id);

      console.error('Error calling process-submission:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to initiate processing retry',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error retrying processing:', error);
    return NextResponse.json(
      { error: 'Failed to retry processing' },
      { status: 500 }
    );
  }
}

