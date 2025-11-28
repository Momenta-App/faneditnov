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

    // Resolve contest ID if a slug was provided
    let resolvedContestId: string | null = null;
    if (contestIdFilter) {
      // Check if it's a UUID or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contestIdFilter);
      
      if (isUUID) {
        resolvedContestId = contestIdFilter;
        console.log('[User Submissions API] Using UUID as contest_id:', resolvedContestId);
      } else {
        // Look up contest by slug
        console.log('[User Submissions API] Looking up contest by slug:', contestIdFilter);
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('contests')
          .select('id')
          .eq('slug', contestIdFilter)
          .single();
        
        if (contestError || !contest) {
          console.error('[User Submissions API] Contest not found for slug:', contestIdFilter, contestError);
          return NextResponse.json({
            data: [],
          });
        }
        
        resolvedContestId = contest.id;
        console.log('[User Submissions API] Found contest:', {
          slug: contestIdFilter,
          id: resolvedContestId,
        });
      }
    }

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
        )
      `)
      .eq('user_id', user.id)
      .eq('user_removed', false) // Exclude submissions removed by user
      .order('created_at', { ascending: false });

    if (resolvedContestId) {
      query = query.eq('contest_id', resolvedContestId);
      console.log('[User Submissions API] Filtering by contest_id:', resolvedContestId);
    } else {
      console.log('[User Submissions API] No contest_id filter - returning all user submissions');
    }

    const { data: submissions, error } = await query;

    if (error) throw error;

    // Safety check: verify all submissions belong to the filtered contest
    if (resolvedContestId) {
      const wrongContestSubmissions = (submissions || []).filter((s: any) => s.contest_id !== resolvedContestId);
      if (wrongContestSubmissions.length > 0) {
        console.error('[User Submissions API] WARNING: Found submissions from wrong contest!', {
          expectedContestId: resolvedContestId,
          wrongSubmissions: wrongContestSubmissions.map((s: any) => ({ id: s.id, contest_id: s.contest_id })),
        });
      }
    }

    console.log('[User Submissions API] Returning submissions:', {
      count: submissions?.length || 0,
      contestIdFilter: resolvedContestId || contestIdFilter || 'all',
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

