/**
 * Admin API route for fetching appeals for a contest
 * GET: Get all appeals for submissions in a contest
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/review/appeals
 * Get all appeals for a contest
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId } = await params;

    // First get all submissions for this contest
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id')
      .eq('contest_id', contestId);

    if (submissionsError) {
      throw submissionsError;
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const submissionIds = submissions.map(s => s.id);

    // Get all appeals for these submissions
    const { data: appeals, error: appealsError } = await supabaseAdmin
      .from('contest_submission_appeals')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          display_name
        ),
        reviewed_by_profile:reviewed_by (
          id,
          email,
          display_name
        )
      `)
      .in('submission_id', submissionIds)
      .order('created_at', { ascending: false });

    if (appealsError) {
      throw appealsError;
    }

    // Get submission details for each appeal
    const { data: submissionDetails, error: detailsError } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        contest_id,
        user_id,
        original_video_url,
        mp4_bucket,
        mp4_path,
        platform,
        hashtag_status,
        description_status,
        content_review_status,
        description_text,
        hashtags_array,
        views_count,
        likes_count,
        comments_count,
        shares_count,
        saves_count,
        impact_score,
        created_at,
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
      .in('id', appeals?.map((a: any) => a.submission_id) || []);

    if (detailsError) {
      throw detailsError;
    }

    // Combine appeals with submission details
    const appealsWithDetails = appeals?.map((appeal: any) => {
      const submission = submissionDetails?.find((s: any) => s.id === appeal.submission_id);
      return {
        ...appeal,
        submission,
      };
    }) || [];

    return NextResponse.json({
      data: appealsWithDetails,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Appeals API] Error fetching appeals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appeals' },
      { status: 500 }
    );
  }
}

