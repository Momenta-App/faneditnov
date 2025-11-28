/**
 * Public API route for tracking private contest access
 * POST: Track when a user accesses a private contest via direct link
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contests/[id]/access
 * Track when user accesses a private contest
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if id is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Get the contest ID (either from UUID or slug lookup)
    let contestId: string;
    if (isUUID) {
      contestId = id;
    } else {
      const { data: contestLookup } = await supabaseAdmin
        .from('contests')
        .select('id, visibility')
        .eq('slug', id)
        .single();
      
      if (!contestLookup) {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      
      // Verify contest is private
      if (contestLookup.visibility !== 'private_link_only') {
        return NextResponse.json(
          { error: 'Contest is not private' },
          { status: 400 }
        );
      }
      
      contestId = contestLookup.id;
    }

    // Verify contest exists and is private
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .select('id, visibility')
      .eq('id', contestId)
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

    if (contest.visibility !== 'private_link_only') {
      return NextResponse.json(
        { error: 'Contest is not private' },
        { status: 400 }
      );
    }

    // Insert or update access record (using upsert with ON CONFLICT)
    const { error: accessError } = await supabaseAdmin
      .from('contest_user_access')
      .upsert({
        contest_id: contestId,
        user_id: sessionUser.id,
        accessed_at: new Date().toISOString(),
      }, {
        onConflict: 'contest_id,user_id',
        ignoreDuplicates: false,
      });

    if (accessError) {
      // If it's a duplicate key error, that's fine - user already has access
      if (accessError.code !== '23505') { // Unique violation
        throw accessError;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Access recorded',
    });
  } catch (error) {
    console.error('Error recording contest access:', error);
    return NextResponse.json(
      { error: 'Failed to record access' },
      { status: 500 }
    );
  }
}

