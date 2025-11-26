/**
 * Public API routes for individual contest
 * GET: Get public contest details
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contests/[id]
 * Get public contest details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get contest with categories and nested prizes
    const { data: contest, error: contestError } = await supabaseAdmin
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
      .eq('id', id)
      .in('status', ['live', 'upcoming', 'closed']) // Allow viewing closed contests too
      .single();

    if (contestError) {
      if (contestError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw contestError;
    }

    // Get approved submission count (content-approved, regardless of processing status)
    const { count: approvedSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id)
      .eq('content_review_status', 'approved');

    // Check if there are multiple contests for the same movie
    let subContests = null;
    if (contest.movie_identifier) {
      const { data: movieContests } = await supabaseAdmin
        .from('contests')
        .select('id, title, status')
        .eq('movie_identifier', contest.movie_identifier)
        .in('status', ['live', 'upcoming'])
        .neq('id', id);

      if (movieContests && movieContests.length > 0) {
        subContests = movieContests;
      }
    }

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: id,
    });

    return NextResponse.json({
      data: {
        ...contest,
        total_prize_pool: totalPool || 0,
        submission_count: approvedSubmissions || 0,
        sub_contests: subContests,
      },
    });
  } catch (error) {
    console.error('Error fetching contest:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contest' },
      { status: 500 }
    );
  }
}

