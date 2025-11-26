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

    // Check if id is a valid UUID (format: 8-4-4-4-12 hex characters)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Build query - support both UUID and slug lookups
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
      .in('status', ['live', 'upcoming', 'closed']); // Allow viewing closed contests too

    // Query by UUID or slug
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data: contest, error: contestError } = await query.single();

    if (contestError) {
      if (contestError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw contestError;
    }

    // Get the actual contest ID (in case we looked up by slug)
    const contestId = contest.id;

    // Try to fetch asset links separately if table exists
    let sortedAssetLinks: any[] = [];
    try {
      const { data: assetLinks } = await supabaseAdmin
        .from('contest_asset_links')
        .select('*')
        .eq('contest_id', contestId)
        .order('display_order', { ascending: true });

      if (assetLinks) {
        sortedAssetLinks = assetLinks;
      }
    } catch (assetLinksError) {
      // Table doesn't exist yet, continue without asset links
      console.log('contest_asset_links table not found, continuing without asset links');
    }

    // Get approved submission count (content-approved, regardless of processing status)
    const { count: approvedSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .eq('content_review_status', 'approved');

    // Check if there are multiple contests for the same movie
    let subContests = null;
    if (contest.movie_identifier) {
      const { data: movieContests } = await supabaseAdmin
        .from('contests')
        .select('id, title, status, slug')
        .eq('movie_identifier', contest.movie_identifier)
        .in('status', ['live', 'upcoming'])
        .neq('id', contestId);

      if (movieContests && movieContests.length > 0) {
        subContests = movieContests;
      }
    }

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: contestId,
    });

    return NextResponse.json({
      data: {
        ...contest,
        total_prize_pool: totalPool || 0,
        submission_count: approvedSubmissions || 0,
        sub_contests: subContests,
        contest_asset_links: sortedAssetLinks,
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

