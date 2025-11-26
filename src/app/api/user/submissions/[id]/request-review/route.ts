/**
 * User API route for requesting manual review
 * POST: Mark submission as pending_review for manual review
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/submissions/[id]/request-review
 * Request manual review for a submission
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

    // Update statuses to pending_review if they failed
    const updates: any = {};
    if (submission.hashtag_status === 'fail') {
      updates.hashtag_status = 'pending_review';
    }
    if (submission.description_status === 'fail') {
      updates.description_status = 'pending_review';
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No failed checks to review' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('contest_submissions')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Review requested',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error requesting review:', error);
    return NextResponse.json(
      { error: 'Failed to request review' },
      { status: 500 }
    );
  }
}

