/**
 * User API route for submitting appeals on contest submissions
 * POST: Create an appeal for a failed hashtag or description check
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/submissions/[id]/appeal
 * Create an appeal for a submission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const body = await request.json();
    const { appeal_type, appeal_reason } = body;

    // Validate request body
    if (!appeal_type || !appeal_reason) {
      return NextResponse.json(
        { error: 'appeal_type and appeal_reason are required' },
        { status: 400 }
      );
    }

    if (!['hashtag', 'description'].includes(appeal_type)) {
      return NextResponse.json(
        { error: 'appeal_type must be either "hashtag" or "description"' },
        { status: 400 }
      );
    }

    if (appeal_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'appeal_reason cannot be empty' },
        { status: 400 }
      );
    }

    // Get submission and verify it belongs to user
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, user_id, hashtag_status, description_status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Validate that the appeal type matches a failed status
    const statusField = appeal_type === 'hashtag' ? 'hashtag_status' : 'description_status';
    const currentStatus = submission[statusField];

    if (currentStatus !== 'fail') {
      return NextResponse.json(
        { error: `Cannot appeal ${appeal_type} check - status is not "fail"` },
        { status: 400 }
      );
    }

    // Check if appeal already exists for this submission and type
    const { data: existingAppeal } = await supabaseAdmin
      .from('contest_submission_appeals')
      .select('id')
      .eq('submission_id', id)
      .eq('appeal_type', appeal_type)
      .single();

    if (existingAppeal) {
      return NextResponse.json(
        { error: `An appeal for ${appeal_type} already exists for this submission` },
        { status: 400 }
      );
    }

    // Create appeal
    const { data: appeal, error: appealError } = await supabaseAdmin
      .from('contest_submission_appeals')
      .insert({
        submission_id: parseInt(id),
        user_id: user.id,
        appeal_type,
        appeal_reason: appeal_reason.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (appealError) {
      console.error('Error creating appeal:', appealError);
      throw appealError;
    }

    return NextResponse.json({
      data: appeal,
      message: 'Appeal submitted successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating appeal:', error);
    return NextResponse.json(
      { error: 'Failed to create appeal' },
      { status: 500 }
    );
  }
}

