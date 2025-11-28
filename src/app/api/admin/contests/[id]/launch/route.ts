/**
 * Admin API route for launching draft contests
 * POST: Launch a draft contest (calculate status based on dates)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/contests/[id]/launch
 * Launch a draft contest by calculating status based on dates
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    // Check if id is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // First, get the contest ID (either from UUID or slug lookup)
    let contestId: string;
    if (isUUID) {
      contestId = id;
    } else {
      const { data: contestLookup } = await supabaseAdmin
        .from('contests')
        .select('id')
        .eq('slug', id)
        .single();
      
      if (!contestLookup) {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      contestId = contestLookup.id;
    }

    // Fetch the contest to verify it's a draft and get dates
    const { data: contest, error: fetchError } = await supabaseAdmin
      .from('contests')
      .select('id, status, start_date, end_date')
      .eq('id', contestId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Verify contest is a draft
    if (contest.status !== 'draft') {
      return NextResponse.json(
        { error: 'Contest is not a draft. Only draft contests can be launched.' },
        { status: 400 }
      );
    }

    // Calculate status based on dates
    const { data: calculatedStatus, error: calcError } = await supabaseAdmin.rpc(
      'calculate_contest_status',
      {
        start_date: contest.start_date,
        end_date: contest.end_date,
      }
    );

    let finalStatus: string;
    if (calcError || !calculatedStatus) {
      // Fallback to manual calculation
      console.error('Error calculating contest status:', calcError);
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
    } else {
      finalStatus = calculatedStatus;
    }

    // Update contest status
    const { data: updatedContest, error: updateError } = await supabaseAdmin
      .from('contests')
      .update({ status: finalStatus })
      .eq('id', contestId)
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
        ),
        contest_asset_links (
          id,
          name,
          url,
          display_order
        )
      `)
      .single();

    if (updateError) throw updateError;

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: contestId,
    });

    return NextResponse.json({
      data: {
        ...updatedContest,
        total_prize_pool: totalPool || 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error launching contest:', error);
    return NextResponse.json(
      { error: 'Failed to launch contest' },
      { status: 500 }
    );
  }
}

