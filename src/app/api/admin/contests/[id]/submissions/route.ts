/**
 * Admin API route for contest submissions
 * GET: Get submissions for a contest with filters and ranking
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

const deriveReviewStatus = (submission: any): ReviewStatus => {
  const contentStatus = submission?.content_review_status?.toLowerCase?.().trim?.();
  const processingStatus = submission?.processing_status?.toLowerCase?.().trim?.();

  if (contentStatus === 'rejected') {
    return 'rejected';
  }

  const processingSuggestsPending =
    processingStatus === 'waiting_review' ||
    processingStatus === 'uploaded' ||
    processingStatus === 'fetching_stats' ||
    processingStatus === 'checking_hashtags' ||
    processingStatus === 'checking_description';

  if (processingSuggestsPending) {
    return 'pending';
  }

  if (contentStatus === 'approved') {
    return 'approved';
  }

  return 'pending';
};

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
    // When "All" is selected (no categoryId), get all submissions without pagination limit
    const categoryId = searchParams.get('category_id');
    const limit = categoryId 
      ? parseInt(searchParams.get('limit') || '50')
      : parseInt(searchParams.get('limit') || '1000'); // Higher limit for "All" to show all submissions
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filters
    const hashtagStatus = searchParams.get('hashtag_status');
    const descriptionStatus = searchParams.get('description_status');
    const contentReviewStatus = searchParams.get('content_review_status');
    const processingStatus = searchParams.get('processing_status');
    const verificationStatus = searchParams.get('verification_status');
    const includeRemoved = searchParams.get('include_removed') !== 'false'; // Default to true (show all)
    const sortBy = searchParams.get('sort_by') || 'views_count'; // views_count or created_at
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc or desc

    // Build query (using direct columns from contest_submissions)
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
    // Filter removed submissions if include_removed is false
    if (!includeRemoved) {
      query = query.eq('user_removed', false);
    }
    // Handle category filtering - check both direct category_id and junction table
    // When categoryId is NOT provided (i.e., "All" is selected), return ALL submissions for the contest
    let submissionIdsForCategory: number[] | null = null;
    
    if (categoryId) {
      // Get submission IDs that are associated with this category either:
      // 1. Directly via category_id column, OR
      // 2. Via contest_submission_categories junction table
      const { data: directSubmissions } = await supabaseAdmin
        .from('contest_submissions')
        .select('id')
        .eq('contest_id', id)
        .eq('category_id', categoryId);
      
      const { data: junctionSubmissions } = await supabaseAdmin
        .from('contest_submission_categories')
        .select('submission_id')
        .eq('category_id', categoryId);
      
      const directIds = directSubmissions?.map(s => s.id) || [];
      const junctionIds = junctionSubmissions?.map(s => s.submission_id) || [];
      const allIds = [...new Set([...directIds, ...junctionIds])];
      
      if (allIds.length > 0) {
        submissionIdsForCategory = allIds;
        query = query.in('id', allIds);
      } else {
        // No submissions match this category, return empty result
        submissionIdsForCategory = [];
        query = query.eq('id', -1); // Impossible condition to return no results
      }
    }
    // When categoryId is null/undefined, query already filters by contest_id only, which returns ALL submissions

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
    
    // Note: We can't order by nested videos_hot columns directly in Supabase
    // So we'll fetch all matching records, sort in memory, then paginate
    // For created_at (which is on contest_submissions), we can still use DB ordering
    if (sortField === 'created_at') {
      query = query.order('created_at', { ascending });
      // Apply pagination before fetching
      query = query.range(offset, offset + limit - 1);
    }
    // For stats fields, we'll sort in memory after fetching

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
    // Apply same removed filter to count query
    if (!includeRemoved) {
      countQuery = countQuery.eq('user_removed', false);
    }
    // Apply same category filter to count query
    // When categoryId is NOT provided (i.e., "All" is selected), count ALL submissions for the contest
    if (categoryId && submissionIdsForCategory !== null) {
      if (submissionIdsForCategory.length > 0) {
        countQuery = countQuery.in('id', submissionIdsForCategory);
      } else {
        countQuery = countQuery.eq('id', -1); // Impossible condition
      }
    }
    // When categoryId is null/undefined, countQuery already filters by contest_id only, which counts ALL submissions

    const { count } = await countQuery;

    console.log('[Admin Submissions API] Query successful:', {
      contestId: id,
      submissionCount: submissions?.length || 0,
      totalCount: count || 0,
      limit,
      offset,
      filters: { hashtagStatus, descriptionStatus, contentReviewStatus, processingStatus, verificationStatus, categoryId, includeRemoved },
      sortBy: sortField,
      sortOrder,
    });
    
    // Sort by videos_hot stats if needed (not created_at)
    let sortedSubmissions = submissions || [];
    if (sortField !== 'created_at' && submissions && submissions.length > 0) {
      sortedSubmissions = [...submissions].sort((a: any, b: any) => {
        const videoHotA = a.videos_hot;
        const videoHotB = b.videos_hot;
        
        // Get values from videos_hot, fallback to 0 if missing
        const getValue = (sub: any, field: string): number => {
          const videoHot = sub.videos_hot;
          if (!videoHot) return 0;
          return videoHot[field] || 0;
        };
        
        let valueA = 0;
        let valueB = 0;
        
        if (sortField === 'views_count') {
          valueA = getValue(a, 'views_count');
          valueB = getValue(b, 'views_count');
        } else if (sortField === 'likes_count') {
          valueA = getValue(a, 'likes_count');
          valueB = getValue(b, 'likes_count');
        } else if (sortField === 'comments_count') {
          valueA = getValue(a, 'comments_count');
          valueB = getValue(b, 'comments_count');
        } else if (sortField === 'shares_count') {
          valueA = getValue(a, 'shares_count');
          valueB = getValue(b, 'shares_count');
        } else if (sortField === 'impact_score') {
          valueA = getValue(a, 'impact_score');
          valueB = getValue(b, 'impact_score');
        }
        
        const comparison = valueA - valueB;
        return ascending ? comparison : -comparison;
      });
      
      // Apply pagination after sorting
      sortedSubmissions = sortedSubmissions.slice(offset, offset + limit);
    }

    // Log submission IDs for debugging
    if (sortedSubmissions && sortedSubmissions.length > 0) {
      console.log('[Admin Submissions API] Submission IDs returned:', sortedSubmissions.map((s: any) => s.id));
    }

    const normalizedSubmissions = sortedSubmissions.map(submission => {
      const derivedStatus = deriveReviewStatus(submission);
      return {
        ...submission,
        content_review_status: derivedStatus,
        derived_review_status: derivedStatus,
      };
    });

    return NextResponse.json({
      data: normalizedSubmissions,
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

