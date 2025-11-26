/**
 * Admin API route for contest submissions
 * GET: Get submissions for a contest with filters and ranking
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/submissions
 * Get submissions for a contest with filters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    console.log('[Admin Submissions API] User authenticated:', { userId: user.id, role: user.role, email: user.email });
    
    const { id } = await params;
    console.log('[Admin Submissions API] Contest ID:', id);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filters
    const hashtagStatus = searchParams.get('hashtag_status');
    const descriptionStatus = searchParams.get('description_status');
    const contentReviewStatus = searchParams.get('content_review_status');
    const processingStatus = searchParams.get('processing_status');
    const verificationStatus = searchParams.get('verification_status');
    const categoryId = searchParams.get('category_id');
    const sortBy = searchParams.get('sort_by') || 'views_count'; // views_count or created_at
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc or desc

    // Build query
    let query = supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          display_name,
          avatar_url
        ),
        social_accounts:social_account_id (
          id,
          platform,
          username,
          verification_status
        ),
        contest_categories:category_id (
          id,
          name,
          display_order,
          is_general,
          ranking_method
        ),
        contest_submission_categories (
          category_id,
          is_primary,
          contest_categories (
            id,
            name,
            is_general,
            ranking_method
          )
        )
      `)
      .eq('contest_id', id);

    // Apply filters
    if (hashtagStatus) {
      query = query.eq('hashtag_status', hashtagStatus);
    }
    if (descriptionStatus) {
      query = query.eq('description_status', descriptionStatus);
    }
    if (contentReviewStatus) {
      query = query.eq('content_review_status', contentReviewStatus);
    }
    if (processingStatus) {
      query = query.eq('processing_status', processingStatus);
    }
    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    // Apply sorting
    // If filtering by category, check if it's stat-based and sort accordingly
    let sortField = sortBy;
    if (categoryId) {
      // Get category ranking method
      const { data: category } = await supabaseAdmin
        .from('contest_categories')
        .select('ranking_method')
        .eq('id', categoryId)
        .single();
      
      if (category?.ranking_method && category.ranking_method !== 'manual') {
        // Map ranking method to field name
        const rankingFieldMap: Record<string, string> = {
          views: 'views_count',
          likes: 'likes_count',
          comments: 'comments_count',
          shares: 'shares_count',
          impact_score: 'views_count',
        };
        sortField = rankingFieldMap[category.ranking_method] || 'views_count';
      }
    }
    
    const ascending = sortOrder === 'asc';
    if (sortField === 'views_count') {
      query = query.order('views_count', { ascending });
    } else if (sortField === 'likes_count') {
      query = query.order('likes_count', { ascending });
    } else if (sortField === 'comments_count') {
      query = query.order('comments_count', { ascending });
    } else if (sortField === 'shares_count') {
      query = query.order('shares_count', { ascending });
    } else if (sortField === 'created_at') {
      query = query.order('created_at', { ascending });
    } else {
      query = query.order('views_count', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: submissions, error } = await query;

    if (error) {
      console.error('[Admin Submissions API] Query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        contestId: id,
      });
      throw error;
    }

    console.log('[Admin Submissions API] Query successful:', {
      contestId: id,
      submissionCount: submissions?.length || 0,
      filters: { hashtagStatus, descriptionStatus, contentReviewStatus, processingStatus, verificationStatus, categoryId },
    });

    // Get total count with same filters
    let countQuery = supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id);

    if (hashtagStatus) {
      countQuery = countQuery.eq('hashtag_status', hashtagStatus);
    }
    if (descriptionStatus) {
      countQuery = countQuery.eq('description_status', descriptionStatus);
    }
    if (contentReviewStatus) {
      countQuery = countQuery.eq('content_review_status', contentReviewStatus);
    }
    if (processingStatus) {
      countQuery = countQuery.eq('processing_status', processingStatus);
    }
    if (verificationStatus) {
      countQuery = countQuery.eq('verification_status', verificationStatus);
    }
    if (categoryId) {
      countQuery = countQuery.eq('category_id', categoryId);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      data: submissions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[Admin Submissions API] Auth error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
      return handleAuthError(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[Admin Submissions API] Error fetching contest submissions:', {
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

