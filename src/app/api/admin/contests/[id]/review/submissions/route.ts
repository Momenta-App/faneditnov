/**
 * Admin API route for contest-specific review submissions
 * GET: List submissions pending review for a specific contest
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/review/submissions
 * Get submissions pending manual review for a specific contest
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    console.log('[Contest Review API] User authenticated:', { userId: user.id, role: user.role, email: user.email });
    
    const { id: contestId } = await params;
    console.log('[Contest Review API] Contest ID:', contestId);

    // Get submissions that need review for this specific contest
    // Filter by contest_id AND any of the review status conditions
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
      .eq('contest_id', contestId)
      .or('hashtag_status.eq.pending_review,description_status.eq.pending_review,content_review_status.eq.pending,mp4_ownership_status.eq.contested')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Contest Review API] Query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        contestId,
      });
      throw error;
    }

    console.log('[Contest Review API] Query successful:', {
      contestId,
      submissionCount: submissions?.length || 0,
    });

    return NextResponse.json({
      data: submissions || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[Contest Review API] Auth error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
      return handleAuthError(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[Contest Review API] Error fetching review submissions:', {
      message: errorMessage,
      details: errorDetails,
    });

    return NextResponse.json(
      { 
        error: 'Failed to fetch submissions',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

