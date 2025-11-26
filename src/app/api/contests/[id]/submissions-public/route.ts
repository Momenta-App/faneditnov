/**
 * Public API route for contest submissions
 * GET: Get approved submissions for a contest (ranked by impact)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contests/[id]/submissions
 * Get approved submissions for public display
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'approved';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Check if id is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // First, get the contest ID (either from UUID or slug lookup)
    let contestId: string;
    if (isUUID) {
      contestId = id;
    } else {
      const { data: contest } = await supabaseAdmin
        .from('contests')
        .select('id')
        .eq('slug', id)
        .single();
      
      if (!contest) {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      contestId = contest.id;
    }

    let query = supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        mp4_bucket,
        mp4_path,
        original_video_url,
        platform,
        video_id,
        impact_score,
        views_count,
        likes_count,
        comments_count,
        shares_count,
        saves_count,
        created_at,
        profiles:user_id (
          id,
          display_name,
          email,
          avatar_url,
          is_verified
        )
      `)
      .eq('contest_id', contestId)
      .eq('content_review_status', 'approved')
      .order('impact_score', { ascending: false })
      .limit(limit);

    const { data: submissions, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: submissions || [],
    });
  } catch (error) {
    console.error('Error fetching contest submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

