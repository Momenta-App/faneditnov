/**
 * Public API routes for contests
 * GET: List public contests (live + upcoming)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contests
 * List public contests (live and upcoming)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status (optional)
    const movie_identifier = searchParams.get('movie_identifier'); // Filter by movie (optional)
    const includeClosedParam = searchParams.get('include_closed') === 'true';
    const includeAllParam = searchParams.get('include_all') === 'true';

    let sessionUser: Awaited<ReturnType<typeof getSessionUser>> = null;
    if (includeClosedParam || includeAllParam) {
      sessionUser = await getSessionUser(request);
    }
    const isAdmin = sessionUser?.role === 'admin';
    const allowClosed = includeClosedParam && isAdmin;
    const allowAll = includeAllParam && isAdmin;

    if (status && !['live', 'upcoming', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    let query = supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          description,
          rules,
          display_order,
          is_general,
          ranking_method,
          contest_prizes (
            id,
            name,
            description,
            payout_amount,
            rank_order
          )
        )
      `)
      .order('start_date', { ascending: true })
      .limit(200);

    if (status) {
      query = query.eq('status', status);
    } else if (allowAll) {
      // No status filtering - admins explicitly requested all contests
    } else if (allowClosed) {
      query = query.in('status', ['live', 'upcoming', 'closed']);
    } else {
      query = query.in('status', ['live', 'upcoming']);
    }

    if (movie_identifier) {
      query = query.eq('movie_identifier', movie_identifier);
    }

    const { data: contests, error } = await query;

    if (error) throw error;

    // Get submission counts and total prize pool for each contest
    const contestsWithStats = await Promise.all(
      (contests || []).map(async (contest) => {
        const { count: totalSubmissions } = await supabaseAdmin
          .from('contest_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest.id)
          .eq('content_review_status', 'approved')
          .eq('processing_status', 'approved');

        // Calculate total prize pool
        const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
          p_contest_id: contest.id,
        });

        return {
          ...contest,
          total_prize_pool: totalPool || 0,
          submission_count: totalSubmissions || 0,
        };
      })
    );

    return NextResponse.json({
      data: contestsWithStats,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching contests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contests' },
      { status: 500 }
    );
  }
}

