/**
 * Admin API route for reviewing appeals
 * PUT: Approve or deny an appeal
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/contests/[id]/review/appeals/[appealId]
 * Approve or deny an appeal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; appealId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, appealId } = await params;

    const body = await request.json();
    const { status, admin_response } = body;

    // Validate request body
    if (!status || !['approved', 'denied'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be either "approved" or "denied"' },
        { status: 400 }
      );
    }

    // Get appeal and verify it belongs to the contest
    const { data: appeal, error: appealError } = await supabaseAdmin
      .from('contest_submission_appeals')
      .select(`
        *,
        contest_submissions!inner (
          id,
          contest_id,
          hashtag_status,
          description_status
        )
      `)
      .eq('id', appealId)
      .eq('contest_submissions.contest_id', contestId)
      .single();

    if (appealError || !appeal) {
      return NextResponse.json(
        { error: 'Appeal not found' },
        { status: 404 }
      );
    }

    const submission = (appeal as any).contest_submissions;

    // Update appeal status
    const { data: updatedAppeal, error: updateError } = await supabaseAdmin
      .from('contest_submission_appeals')
      .update({
        status,
        admin_response: admin_response?.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appealId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // If appeal is approved, update the submission status
    if (status === 'approved') {
      const statusField = appeal.appeal_type === 'hashtag' ? 'hashtag_status' : 'description_status';
      
      const { error: submissionUpdateError } = await supabaseAdmin
        .from('contest_submissions')
        .update({
          [statusField]: 'approved_manual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (submissionUpdateError) {
        console.error('Error updating submission status:', submissionUpdateError);
        // Don't fail the request, but log the error
      }
    }

    return NextResponse.json({
      data: updatedAppeal,
      message: `Appeal ${status} successfully`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Appeals API] Error updating appeal:', error);
    return NextResponse.json(
      { error: 'Failed to update appeal' },
      { status: 500 }
    );
  }
}

