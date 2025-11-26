/**
 * Admin API route for manually triggering validation on a submission
 * POST: Re-run hashtag and description validation
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/contests/[id]/submissions/[submissionId]/validate
 * Manually trigger validation for a submission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, submissionId } = await params;

    console.log('[Manual Validation] Triggering validation:', {
      contestId,
      submissionId,
      adminId: user.id,
    });

    // Get submission with contest data
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
      .eq('contest_id', contestId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const contest = submission.contests as any;

    // Check if we have BrightData data for this submission
    // Try to find the latest snapshot data
    let record: any = null;

    if (submission.snapshot_id) {
      // Try to fetch data from BrightData API if we have snapshot_id
      // For now, we'll mark it as needing re-scraping
      console.log('[Manual Validation] Submission has snapshot_id, but data not available for re-validation');
    }

    // If we don't have record data, trigger a new BrightData collection
    if (!record) {
      // Trigger background processing which will fetch fresh data
      const processUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contests/process-submission`;
      
      try {
        const processResponse = await fetch(processUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: submission.id }),
        });

        if (processResponse.ok) {
          return NextResponse.json({
            success: true,
            message: 'Validation re-triggered. Fresh data will be fetched and validation will run automatically.',
          });
        } else {
          const errorText = await processResponse.text();
          return NextResponse.json(
            { 
              error: 'Failed to trigger re-processing',
              details: errorText,
            },
            { status: 500 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { 
            error: 'Failed to trigger re-processing',
            details: err instanceof Error ? err.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // If we have record data, perform validation immediately
    // (This would require storing the BrightData response, which we don't currently do)
    // For now, we'll just trigger re-processing

    return NextResponse.json({
      success: true,
      message: 'Validation triggered successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Manual Validation] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger validation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

