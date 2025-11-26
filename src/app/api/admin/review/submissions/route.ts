/**
 * Admin API route for review submissions
 * GET: List submissions pending review
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/review/submissions
 * Get submissions pending manual review
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    // Get submissions that need review
    const { data: submissions, error } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          display_name
        ),
        contests:contest_id (
          id,
          title,
          required_hashtags,
          required_description_template
        )
      `)
      .or('hashtag_status.eq.pending_review,description_status.eq.pending_review,content_review_status.eq.pending,mp4_ownership_status.eq.contested')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data: submissions || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching review submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

