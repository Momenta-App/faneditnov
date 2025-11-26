/**
 * Admin API route for updating contest submission review status
 * GET: Get a single submission for review
 * PUT: Update submission review statuses
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/review/submissions/[submissionId]
 * Get a single submission for review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, submissionId } = await params;

    const { data: submission, error } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          display_name
        ),
        contests:contest_id (
          id,
          title,
          required_hashtags,
          required_description_template
        )
      `)
      .eq('id', submissionId)
      .eq('contest_id', contestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: submission });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Review API] Error fetching submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/contests/[id]/review/submissions/[submissionId]
 * Update submission review statuses
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, submissionId } = await params;

    const body = await request.json();
    const { hashtag_status, description_status, content_review_status } = body;

    // Verify submission belongs to contest
    const { data: existingSubmission } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, contest_id')
      .eq('id', submissionId)
      .single();

    if (!existingSubmission || existingSubmission.contest_id !== contestId) {
      return NextResponse.json(
        { error: 'Submission not found in this contest' },
        { status: 404 }
      );
    }

    const updates: any = {};
    if (hashtag_status) updates.hashtag_status = hashtag_status;
    if (description_status) updates.description_status = description_status;
    if (content_review_status) {
      updates.content_review_status = content_review_status;
      // If content is approved and both checks pass, update processing status
      if (content_review_status === 'approved') {
        const { data: submission } = await supabaseAdmin
          .from('contest_submissions')
          .select('hashtag_status, description_status')
          .eq('id', submissionId)
          .single();

        if (submission) {
          const hashtagPass =
            submission.hashtag_status === 'pass' ||
            submission.hashtag_status === 'approved_manual';
          const descriptionPass =
            submission.description_status === 'pass' ||
            submission.description_status === 'approved_manual';

          if (hashtagPass && descriptionPass) {
            updates.processing_status = 'approved';
          }
        }
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contest_submissions')
      .update(updates)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Review API] Error updating submission:', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}

