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
    const limit = parseInt(searchParams.get('limit') || '50'); // Default 50 items per page for pagination
    const offset = parseInt(searchParams.get('offset') || '0');
    const categoryId = searchParams.get('category_id');

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

    // Verify contestId is set
    if (!contestId) {
      console.error('[Submissions Public API] No contestId resolved');
      return NextResponse.json(
        { error: 'Contest ID is required' },
        { status: 400 }
      );
    }
    
    // Test query step by step to identify the issue
    console.log('[Submissions Public API] Starting query for contestId:', contestId, 'from input id:', id);
    
    // Step 1: Test basic query without relations
    console.log('[Submissions Public API] Step 1: Testing basic query...');
    const basicTest = await supabaseAdmin
      .from('contest_submissions')
      .select('id, contest_id')
      .eq('contest_id', contestId)
      .limit(1);
    
    if (basicTest.error) {
      console.error('[Submissions Public API] Basic test failed:', basicTest.error);
      throw new Error(`Basic query failed: ${basicTest.error.message} (Code: ${basicTest.error.code})`);
    }
    console.log('[Submissions Public API] Basic query successful, found', basicTest.data?.length || 0, 'submissions');
    
    // Step 2: Test with all main columns (using direct columns from contest_submissions)
    console.log('[Submissions Public API] Step 2: Testing with all main columns...');
    const columnsTest = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        contest_id,
        mp4_bucket,
        mp4_path,
        original_video_url,
        platform,
        video_id,
        views_count,
        likes_count,
        comments_count,
        shares_count,
        saves_count,
        impact_score,
        created_at,
        hashtag_status,
        description_status,
        mp4_ownership_status,
        verification_status,
        content_review_status,
        user_id
      `)
      .eq('contest_id', contestId)
      .limit(1);
    
    if (columnsTest.error) {
      console.error('[Submissions Public API] Columns test failed:', {
        message: columnsTest.error.message,
        code: columnsTest.error.code,
        hint: columnsTest.error.hint,
        details: columnsTest.error.details,
      });
      throw new Error(`Columns query failed: ${columnsTest.error.message} (Code: ${columnsTest.error.code}). Hint: ${columnsTest.error.hint || 'none'}`);
    }
    console.log('[Submissions Public API] Columns query successful');
    
    // Step 3: Test with profiles relation
    console.log('[Submissions Public API] Step 3: Testing with profiles relation...');
    const profilesTest = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        user_id,
        profiles:user_id (
          id,
          display_name,
          email
        )
      `)
      .eq('contest_id', contestId)
      .limit(1);
    
    if (profilesTest.error) {
      console.error('[Submissions Public API] Profiles relation test failed:', profilesTest.error);
      console.log('[Submissions Public API] Will skip profiles relation in final query');
    } else {
      console.log('[Submissions Public API] Profiles relation successful');
    }
    
    // Step 4: Test with contest_submission_categories relation
    console.log('[Submissions Public API] Step 4: Testing with contest_submission_categories relation...');
    const categoriesTest = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        contest_submission_categories (
          category_id,
          is_primary
        )
      `)
      .eq('contest_id', contestId)
      .limit(1);
    
    if (categoriesTest.error) {
      console.error('[Submissions Public API] Categories relation test failed:', categoriesTest.error);
      console.log('[Submissions Public API] Will skip categories relation in final query');
    } else {
      console.log('[Submissions Public API] Categories relation successful');
    }
    
    // Step 5: Test nested contest_categories
    console.log('[Submissions Public API] Step 5: Testing nested contest_categories...');
    const nestedCategoriesTest = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        contest_submission_categories (
          category_id,
          contest_categories (
            id,
            name
          )
        )
      `)
      .eq('contest_id', contestId)
      .limit(1);
    
    if (nestedCategoriesTest.error) {
      console.error('[Submissions Public API] Nested categories test failed:', nestedCategoriesTest.error);
      console.log('[Submissions Public API] Will use simplified categories relation');
    } else {
      console.log('[Submissions Public API] Nested categories successful');
    }
    
    // Final query: Build based on what works
    console.log('[Submissions Public API] Step 6: Building final query...');
    let finalSelect = `
      id,
      contest_id,
      mp4_bucket,
      mp4_path,
      original_video_url,
      platform,
      video_id,
      views_count,
      likes_count,
      comments_count,
      shares_count,
      saves_count,
      impact_score,
      cover_url,
      created_at,
      hashtag_status,
      description_status,
      mp4_ownership_status,
      verification_status,
      content_review_status,
      user_id
    `;
    
    // Always try to include profiles - if it fails, we'll handle it
    finalSelect += `,
      profiles:user_id (
        id,
        display_name,
        email,
        avatar_url,
        is_verified
      )`;
    
    // Always try to include contest_submission_categories - needed for filtering
    if (!categoriesTest.error && !nestedCategoriesTest.error) {
      finalSelect += `,
      contest_submission_categories (
        category_id,
        is_primary,
        contest_categories (
          id,
          name,
          is_general,
          ranking_method
        )
      )`;
    } else if (!categoriesTest.error) {
      // Use simplified version without nested contest_categories
      finalSelect += `,
      contest_submission_categories (
        category_id,
        is_primary
      )`;
    } else {
      // Even if the test failed, try to include it - might work in the full query
      console.warn('[Submissions Public API] Categories test failed, but including in final query anyway');
      finalSelect += `,
      contest_submission_categories (
        category_id,
        is_primary
      )`;
    }
    
    // Build query with category filter if specified
    let finalQuery = supabaseAdmin
      .from('contest_submissions')
      .select(finalSelect)
      .eq('contest_id', contestId); // CRITICAL: Filter by contest_id
    
    // Filter by category if specified - use database-level filtering
    // Check BOTH direct category_id column AND junction table (like admin API does)
    let validSubmissionIds: number[] | null = null;
    let totalCountBeforePagination = 0;
    
    if (categoryId) {
      // 1. Get submissions with direct category_id match for this contest
      const { data: directSubmissions } = await supabaseAdmin
        .from('contest_submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('category_id', categoryId);
      
      // 2. Get all submission IDs from junction table for this category
      const { data: junctionSubmissions } = await supabaseAdmin
        .from('contest_submission_categories')
        .select('submission_id')
        .eq('category_id', categoryId);
      
      const directIds = directSubmissions?.map((s: any) => s.id) || [];
      const junctionIds = junctionSubmissions?.map((s: any) => s.submission_id) || [];
      
      // 3. Verify junction table submissions belong to this contest
      // (direct submissions already filtered by contest_id)
      validSubmissionIds = [...directIds];
      
      if (junctionIds.length > 0) {
        const { data: junctionSubmissionsWithContest } = await supabaseAdmin
          .from('contest_submissions')
          .select('id')
          .eq('contest_id', contestId)
          .in('id', junctionIds);
        
        const validJunctionIds = junctionSubmissionsWithContest?.map((s: any) => s.id) || [];
        validSubmissionIds = [...new Set([...directIds, ...validJunctionIds])];
      }
      
      if (validSubmissionIds.length > 0) {
        // Filter submissions to only those in this category
        finalQuery = finalQuery.in('id', validSubmissionIds);
        // Total count is the number of valid submission IDs
        totalCountBeforePagination = validSubmissionIds.length;
        console.log('[Submissions Public API] Filtering by category:', categoryId, {
          directMatches: directIds.length,
          junctionCandidates: junctionIds.length,
          validJunctionMatches: validSubmissionIds.length - directIds.length,
          totalMatches: validSubmissionIds.length,
        });
      } else {
        // No submissions match this category, return empty result
        console.log('[Submissions Public API] No submissions found for category:', categoryId);
        return NextResponse.json({
          data: [],
          total: 0,
          limit,
          offset,
          hasMore: false,
        });
      }
    } else {
      // No category filter - get total count for all submissions in contest
      const { count } = await supabaseAdmin
        .from('contest_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('contest_id', contestId);
      totalCountBeforePagination = count || 0;
    }
    
    // Note: We can't order by nested videos_hot.impact_score directly in Supabase
    // So we'll fetch all matching records, sort in memory, then paginate
    // For now, order by created_at as fallback, then sort by impact_score in memory
    finalQuery = finalQuery.order('created_at', { ascending: false });
    
    // We'll fetch more records than needed, sort by impact_score, then paginate
    // This is a limitation of Supabase - can't order by nested relations
    const fetchLimit = Math.min(limit * 10, 1000); // Fetch up to 10x limit or 1000, whichever is smaller
    finalQuery = finalQuery.range(0, fetchLimit - 1);
    
    console.log('[Submissions Public API] Executing final query with contest_id filter:', contestId, 'category:', categoryId || 'all');
    const { data: submissions, error } = await finalQuery;
    
    // Sort by impact_score from videos_hot if we have submissions
    let sortedSubmissions = submissions || [];
    if (submissions && submissions.length > 0) {
      sortedSubmissions = [...submissions].sort((a: any, b: any) => {
        const impactA = a.videos_hot?.impact_score || 0;
        const impactB = b.videos_hot?.impact_score || 0;
        return impactB - impactA; // Descending order
      });
      
      // Apply pagination after sorting
      sortedSubmissions = sortedSubmissions.slice(offset, offset + limit);
    }
    
    // Verify all submissions belong to this contest
    if (sortedSubmissions && sortedSubmissions.length > 0) {
      const wrongContest = sortedSubmissions.filter((s: any) => s.contest_id !== contestId);
      if (wrongContest.length > 0) {
        console.error('[Submissions Public API] ERROR: Query returned submissions from wrong contest!', {
          expectedContestId: contestId,
          wrongSubmissions: wrongContest.map((s: any) => ({ id: s.id, contest_id: s.contest_id })),
        });
      } else {
        console.log('[Submissions Public API] All submissions belong to contest:', contestId);
      }
    }
    
    if (error) {
      console.error('[Submissions Public API] Final query error:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      
      // If final query fails, use the columns-only version
      console.log('[Submissions Public API] Final query failed, using columns-only fallback...');
      // Don't try to join videos_hot in fallback - just get basic submission data
      const fallbackQuery = supabaseAdmin
        .from('contest_submissions')
        .select(`
          id,
          contest_id,
          mp4_bucket,
          mp4_path,
          original_video_url,
          platform,
          video_id,
          views_count,
          likes_count,
          comments_count,
          shares_count,
          saves_count,
          impact_score,
          cover_url,
          created_at,
          hashtag_status,
          description_status,
          mp4_ownership_status,
          verification_status,
          content_review_status,
          user_id
        `)
        .eq('contest_id', contestId)
        .order('created_at', { ascending: false })
        .limit(limit * 2);
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      
      if (fallbackError) {
        console.error('[Submissions Public API] Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
      
      // Filter and return fallback data
      let filteredFallback = (fallbackData || []).filter((submission: any) => {
        if (submission.hashtag_status === 'fail') return false;
        if (submission.description_status === 'fail') return false;
        if (submission.content_review_status === 'rejected') return false;
        const ownershipStatus = submission.mp4_ownership_status || submission.verification_status;
        if (ownershipStatus === 'failed') return false;
        return true;
      });
      
      // Apply category filter if specified
      if (categoryId && validSubmissionIds) {
        filteredFallback = filteredFallback.filter((s: any) => validSubmissionIds.includes(s.id));
      }
      
      // Sort by impact_score and apply pagination
      filteredFallback = filteredFallback
        .sort((a: any, b: any) => (b.impact_score || 0) - (a.impact_score || 0))
        .slice(offset, offset + limit);
      
      // Try to fetch profiles separately for fallback data
      const userIds = [...new Set(filteredFallback.map((s: any) => s.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabaseAdmin
          .from('profiles')
          .select('id, display_name, email, avatar_url, is_verified')
          .in('id', userIds);
        
        // Attach profiles to submissions
        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        filteredFallback.forEach((submission: any) => {
          if (submission.user_id && profilesMap.has(submission.user_id)) {
            submission.profiles = profilesMap.get(submission.user_id);
          }
        });
      }
      
      // Try to fetch contest_submission_categories separately
      const submissionIds = filteredFallback.map((s: any) => s.id);
      if (submissionIds.length > 0) {
        const { data: categoriesData } = await supabaseAdmin
          .from('contest_submission_categories')
          .select('submission_id, category_id, is_primary')
          .in('submission_id', submissionIds);
        
        // Attach categories to submissions
        const categoriesMap = new Map<number, any[]>();
        categoriesData?.forEach((c: any) => {
          if (!categoriesMap.has(c.submission_id)) {
            categoriesMap.set(c.submission_id, []);
          }
          categoriesMap.get(c.submission_id)!.push(c);
        });
        
        filteredFallback.forEach((submission: any) => {
          if (categoriesMap.has(submission.id)) {
            submission.contest_submission_categories = categoriesMap.get(submission.id);
          }
        });
      }
      
      return NextResponse.json({
        data: filteredFallback,
        total: totalCountBeforePagination,
        limit,
        offset,
        hasMore: offset + limit < totalCountBeforePagination,
      });
    }

    // Filter out submissions with failed checks (client-side filtering for better control)
    // Also filter by category if specified
    let filteredSubmissions = (sortedSubmissions || []).filter((submission: any) => {
      // Exclude if hashtag check failed
      if (submission.hashtag_status === 'fail') {
        return false;
      }
      
      // Exclude if description check failed
      if (submission.description_status === 'fail') {
        return false;
      }
      
      // Exclude if content review rejected
      if (submission.content_review_status === 'rejected') {
        return false;
      }
      
      // Exclude if ownership has failed (check both fields)
      const ownershipStatus = submission.mp4_ownership_status || submission.verification_status;
      if (ownershipStatus === 'failed') {
        return false;
      }

      // Category filtering is now done at database level, but keep this as a safety check
      if (categoryId) {
        const categories = submission.contest_submission_categories || [];
        
        // Check if submission has this category
        // Handle both direct category_id and nested structure
        const hasCategory = categories.some((csc: any) => {
          const catId = csc.category_id || csc.contest_categories?.id;
          return catId === categoryId || String(catId) === String(categoryId);
        });
        
        if (!hasCategory) {
          // This shouldn't happen if database filtering worked, but keep as safety check
          console.warn('[Submissions Public API] Submission missing expected category:', {
            submissionId: submission.id,
            expectedCategory: categoryId,
            actualCategories: categories.map((c: any) => c.category_id || c.contest_categories?.id),
          });
          return false;
        }
      }

      return true;
    });

    // Total count is already calculated before pagination
    // filteredSubmissions are already paginated by the query range
    // But we still need to filter out failed submissions, so count after that
    const totalCount = totalCountBeforePagination || 0;
    
    // Note: filteredSubmissions are already limited by the query range
    // We just filter out failed submissions here

    // Verify all submissions belong to this contest (safety check)
    const wrongContestSubmissions = (sortedSubmissions || []).filter((s: any) => s.contest_id !== contestId);
    if (wrongContestSubmissions.length > 0) {
      console.error('[Submissions Public API] WARNING: Found submissions from wrong contest!', {
        expectedContestId: contestId,
        wrongSubmissions: wrongContestSubmissions.map((s: any) => ({ id: s.id, contest_id: s.contest_id })),
      });
    }
    
    // Check if profiles are loaded
    const submissionsWithoutProfiles = (sortedSubmissions || []).filter((s: any) => !s.profiles && s.user_id);
    if (submissionsWithoutProfiles.length > 0) {
      console.warn('[Submissions Public API] Some submissions missing profiles:', {
        count: submissionsWithoutProfiles.length,
        userIds: submissionsWithoutProfiles.map((s: any) => s.user_id),
      });
      
      // Try to fetch missing profiles
      const missingUserIds = [...new Set(submissionsWithoutProfiles.map((s: any) => s.user_id).filter(Boolean))];
      if (missingUserIds.length > 0) {
        const { data: profilesData } = await supabaseAdmin
          .from('profiles')
          .select('id, display_name, email, avatar_url, is_verified')
          .in('id', missingUserIds);
        
        // Attach profiles to submissions
        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        sortedSubmissions.forEach((submission: any) => {
          if (!submission.profiles && submission.user_id && profilesMap.has(submission.user_id)) {
            submission.profiles = profilesMap.get(submission.user_id);
          }
        });
      }
    }
    
    // Debug logging
    console.log('[Submissions Public API] Success:', {
      contestId,
      categoryId: categoryId || 'all',
      totalFetched: sortedSubmissions?.length || 0,
      afterStatusFiltering: filteredSubmissions.length,
      totalCountBeforePagination,
      limit,
      offset,
      allSubmissionsHaveCorrectContest: wrongContestSubmissions.length === 0,
      submissionsWithProfiles: (sortedSubmissions || []).filter((s: any) => s.profiles).length,
      sampleSubmissionCategories: filteredSubmissions.length > 0 ? (filteredSubmissions[0].contest_submission_categories || []).map((c: any) => ({
        category_id: c.category_id,
        categoryName: c.contest_categories?.name,
      })) : [],
      firstSubmissionId: filteredSubmissions.length > 0 ? filteredSubmissions[0].id : null,
    });

    return NextResponse.json({
      data: filteredSubmissions,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    const errorCode = error?.code || 'UNKNOWN';
    const errorHint = error?.hint || '';
    
    console.error('[Submissions Public API] Error fetching contest submissions:', {
      message: errorMessage,
      code: errorCode,
      hint: errorHint,
      details: errorDetails,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch submissions',
        message: errorMessage,
        code: errorCode,
        hint: errorHint,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      },
      { status: 500 }
    );
  }
}

