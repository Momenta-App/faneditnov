/**
 * User API route for contest submission
 * DELETE: Soft delete a user's submission (removes from user view but keeps data)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/submissions/[id]
 * Soft delete a user's contest submission by setting user_removed flag
 * This removes it from the user's view but preserves all data for contest statistics
 */
export async function DELETE(
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

    // Check if already removed
    if (submission.user_removed) {
      return NextResponse.json({
        success: true,
        message: 'Submission already removed from profile',
      });
    }

    // Soft delete: Set user_removed flag instead of deleting
    // This preserves the submission data and video files for contest statistics
    const { error: updateError } = await supabaseAdmin
      .from('contest_submissions')
      .update({
        user_removed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id); // Extra security check

    if (updateError) {
      console.error('Error removing submission:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Submission removed from profile successfully. It will still be counted in contest statistics.',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error removing submission:', error);
    return NextResponse.json(
      { error: 'Failed to remove submission' },
      { status: 500 }
    );
  }
}

