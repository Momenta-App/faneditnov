/**
 * User API route for contest submissions
 * GET: Get user's contest submissions with latest status
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/submissions
 * Get user's contest submissions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const contestIdFilter = searchParams.get('contest_id');

    let query = supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        contests:contest_id (
          id,
          title,
          movie_identifier,
          status,
          required_hashtags,
          required_description_template
        ),
        contest_categories:category_id (
          id,
          name,
          display_order,
          is_general,
          ranking_method
        ),
        contest_submission_categories (
          category_id,
          is_primary,
          contest_categories (
            id,
            name,
            is_general,
            ranking_method
          )
        ),
        videos_hot:video_hot_id (
          video_id,
          post_id,
          creator_id,
          url,
          caption,
          description,
          cover_url,
          thumbnail_url,
          video_url,
          platform,
          views_count,
          likes_count,
          comments_count,
          shares_count,
          collect_count,
          impact_score,
          creators_hot:creator_id (
            creator_id,
            username,
            display_name,
            avatar_url,
            verified
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('user_removed', false) // Exclude submissions removed by user
      .order('created_at', { ascending: false });

    if (contestIdFilter) {
      query = query.eq('contest_id', contestIdFilter);
      console.log('[User Submissions API] Filtering by contest_id:', contestIdFilter);
    } else {
      console.log('[User Submissions API] No contest_id filter - returning all user submissions');
    }

    const { data: submissions, error } = await query;

    if (error) throw error;

    // Safety check: verify all submissions belong to the filtered contest
    if (contestIdFilter) {
      const wrongContestSubmissions = (submissions || []).filter((s: any) => s.contest_id !== contestIdFilter);
      if (wrongContestSubmissions.length > 0) {
        console.error('[User Submissions API] WARNING: Found submissions from wrong contest!', {
          expectedContestId: contestIdFilter,
          wrongSubmissions: wrongContestSubmissions.map((s: any) => ({ id: s.id, contest_id: s.contest_id })),
        });
      }
    }

    console.log('[User Submissions API] Returning submissions:', {
      count: submissions?.length || 0,
      contestIdFilter: contestIdFilter || 'all',
    });

    return NextResponse.json({
      data: submissions || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching user submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

