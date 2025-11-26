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
    const { id: contestId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'approved';
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        mp4_bucket,
        mp4_path,
        impact_score,
        views_count,
        likes_count,
        comments_count,
        profiles:user_id (
          id,
          display_name,
          email
        )
      `)
      .eq('contest_id', contestId)
      .eq('content_review_status', 'approved')
      .eq('processing_status', 'approved')
      .eq('mp4_ownership_status', 'verified')
      .order('views_count', { ascending: false })
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

