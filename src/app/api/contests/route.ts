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

    // Always try to get session user for visibility checks
    const sessionUser = await getSessionUser(request);
    const isAdmin = sessionUser?.role === 'admin';
    const allowClosed = includeClosedParam && isAdmin;
    const allowAll = includeAllParam && isAdmin;

    if (status && !['live', 'upcoming', 'ended', 'draft'].includes(status)) {
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

    // Try to query with nested relations, fall back to basic query if relations don't exist
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

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    } else if (allowAll) {
      // No status filtering - admins explicitly requested all contests
    } else if (allowClosed) {
      query = query.in('status', ['live', 'upcoming', 'ended']);
    } else {
      // Exclude drafts from public view, but include ended contests
      query = query.in('status', ['live', 'upcoming', 'ended']);
    }

    // Exclude drafts from public view unless admin
    if (!isAdmin) {
      query = query.neq('status', 'draft');
    }

    if (movie_identifier) {
      query = query.eq('movie_identifier', movie_identifier);
    }

    let { data: contests, error } = await query;

    // If query fails due to missing relations, try simpler query
    if (error && (error.message?.includes('relation') || error.message?.includes('column'))) {
      console.log('Retrying with simpler query due to:', error.message);
      let simpleQuery = supabaseAdmin
        .from('contests')
        .select('*')
        .order('start_date', { ascending: true })
        .limit(200);

      // Apply same filters
      if (status) {
        simpleQuery = simpleQuery.eq('status', status);
      } else if (allowAll) {
        // No status filtering
      } else if (allowClosed) {
        simpleQuery = simpleQuery.in('status', ['live', 'upcoming', 'ended']);
      } else {
        simpleQuery = simpleQuery.in('status', ['live', 'upcoming', 'ended']);
      }

      if (!isAdmin) {
        simpleQuery = simpleQuery.neq('status', 'draft');
      }

      if (movie_identifier) {
        simpleQuery = simpleQuery.eq('movie_identifier', movie_identifier);
      }

      const simpleResult = await simpleQuery;
      if (simpleResult.error) throw simpleResult.error;
      contests = simpleResult.data;
    } else if (error) {
      throw error;
    }

    // Filter contests by visibility and user access
    if (contests && contests.length > 0) {
      // Get user's private contest access records if authenticated
      let userAccessContestIds: string[] = [];
      if (sessionUser) {
        const { data: accessRecords } = await supabaseAdmin
          .from('contest_user_access')
          .select('contest_id')
          .eq('user_id', sessionUser.id);
        
        if (accessRecords) {
          userAccessContestIds = accessRecords.map((r: any) => r.contest_id);
        }
      }

      // Filter contests based on visibility
      contests = contests.filter((contest: any) => {
        // Admins and creators can see all contests
        if (isAdmin || contest.created_by === sessionUser?.id) {
          return true;
        }

        // Open contests are visible to everyone
        if (contest.visibility === 'open') {
          return true;
        }

        // Private contests only visible if user has access
        if (contest.visibility === 'private_link_only') {
          return userAccessContestIds.includes(contest.id);
        }

        // Default: hide contest
        return false;
      });
    }

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

    // Get submission counts and total prize pool for each contest, and recalculate status
    const contestsWithStats = await Promise.all(
      (contests || []).map(async (contest) => {
        // Recalculate status if not draft (to ensure it's up-to-date)
        let finalStatus = contest.status;
        if (contest.status !== 'draft') {
          const { data: calculatedStatus, error: calcError } = await supabaseAdmin.rpc(
            'calculate_contest_status',
            {
              start_date: contest.start_date,
              end_date: contest.end_date,
            }
          );

          if (!calcError && calculatedStatus && calculatedStatus !== contest.status) {
            // Update status in database
            await supabaseAdmin
              .from('contests')
              .update({ status: calculatedStatus })
              .eq('id', contest.id);
            
            finalStatus = calculatedStatus;
          } else if (calcError) {
            // Fallback to manual calculation if function fails
            const now = new Date();
            const start = new Date(contest.start_date);
            const end = new Date(contest.end_date);
            
            if (now < start) {
              finalStatus = 'upcoming';
            } else if (now >= start && now <= end) {
              finalStatus = 'live';
            } else {
              finalStatus = 'ended';
            }
          }
        }

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
          status: finalStatus,
          total_prize_pool: totalPool || 0,
          submission_count: totalSubmissions ?? 0,
        };
      })
    );

    // Separate contests into sections
    const openContests = contestsWithStats.filter((c: any) => c.visibility === 'open');
    const privateContests = contestsWithStats.filter((c: any) => c.visibility === 'private_link_only');
    const draftContests = isAdmin ? contestsWithStats.filter((c: any) => c.status === 'draft') : [];

    return NextResponse.json({
      data: contestsWithStats, // Keep for backward compatibility
      open_contests: openContests,
      private_contests: privateContests,
      draft_contests: draftContests,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching contests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contests',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

