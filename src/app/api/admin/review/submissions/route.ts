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
    console.log('[Admin Review API] User authenticated:', { userId: user.id, role: user.role, email: user.email });

    // First, get total count of all submissions for debugging
    const { count: totalCount } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true });
    
    console.log('[Admin Review API] Total submissions in database:', totalCount);

    // Get counts for each status type for debugging
    const { count: pendingHashtagCount } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('hashtag_status', 'pending_review');
    
    const { count: pendingDescriptionCount } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('description_status', 'pending_review');
    
    const { count: pendingContentCount } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('content_review_status', 'pending');
    
    const { count: contestedOwnershipCount } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('mp4_ownership_status', 'contested');

    console.log('[Admin Review API] Status counts:', {
      pendingHashtag: pendingHashtagCount,
      pendingDescription: pendingDescriptionCount,
      pendingContent: pendingContentCount,
      contestedOwnership: contestedOwnershipCount,
    });

    // Get submissions that need review using .or() filter
    // Supabase .or() syntax: 'column1.eq.value1,column2.eq.value2'
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

    if (error) {
      console.error('[Admin Review API] Query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log('[Admin Review API] Query successful:', {
      submissionCount: submissions?.length || 0,
      firstFewIds: submissions?.slice(0, 3).map(s => s.id) || [],
    });

    return NextResponse.json({
      data: submissions || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[Admin Review API] Auth error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
      return handleAuthError(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[Admin Review API] Error fetching review submissions:', {
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

