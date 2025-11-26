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
          required_hashtags
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
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (contestIdFilter) {
      query = query.eq('contest_id', contestIdFilter);
    }

    const { data: submissions, error } = await query;

    if (error) throw error;

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

