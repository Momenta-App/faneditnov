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

    // Try to query with asset links, fall back to basic query if table doesn't exist
    let query = supabaseAdmin
      .from('contests')
      .select(`
        *,
        slug,
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

    let { data: contests, error } = await query;

    if (error) throw error;

    // Try to fetch asset links separately if table exists
    if (contests && contests.length > 0) {
      try {
        const contestIds = contests.map((c: any) => c.id);
        const { data: assetLinks } = await supabaseAdmin
          .from('contest_asset_links')
          .select('*')
          .in('contest_id', contestIds)
          .order('display_order', { ascending: true });

        if (assetLinks) {
          // Group asset links by contest_id
          const assetLinksByContest = assetLinks.reduce((acc: any, link: any) => {
            if (!acc[link.contest_id]) {
              acc[link.contest_id] = [];
            }
            acc[link.contest_id].push(link);
            return acc;
          }, {});

          // Attach asset links to contests
          contests = contests.map((contest: any) => ({
            ...contest,
            contest_asset_links: assetLinksByContest[contest.id] || [],
          }));
        }
      } catch (assetLinksError) {
        // Table doesn't exist yet, continue without asset links
        console.log('contest_asset_links table not found, continuing without asset links');
        contests = contests.map((contest: any) => ({
          ...contest,
          contest_asset_links: [],
        }));
      }
    }

    // Get submission counts and total prize pool for each contest
    const contestsWithStats = await Promise.all(
      (contests || []).map(async (contest) => {
        // Count all submissions for the contest (matching admin page behavior)
        const { count: totalSubmissions, error: countError } = await supabaseAdmin
          .from('contest_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest.id);

        if (countError) {
          console.error(`Error counting submissions for contest ${contest.id}:`, countError);
        }

        // Calculate total prize pool
        const { data: totalPool, error: poolError } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
          p_contest_id: contest.id,
        });

        if (poolError) {
          console.error(`Error calculating prize pool for contest ${contest.id}:`, poolError);
        }

        return {
          ...contest,
          total_prize_pool: totalPool || 0,
          submission_count: totalSubmissions ?? 0,
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

