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
 * Get all submissions for a specific contest
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

    // Get all submissions for this specific contest (admin can see all users' submissions)
    // Using supabaseAdmin with service role should bypass RLS automatically
    // However, if RLS is still being applied, we need to ensure service role policies exist
    
    // CRITICAL: Use RPC call to bypass RLS entirely if needed
    // First, verify we can see all submissions by checking the count
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', contestId);
    
    if (countError) {
      console.error('[Contest Review API] Count query error:', countError);
    }
    
    console.log('[Contest Review API] Total submissions in database for contest:', totalCount);
    
    // Also check all submissions without joins to see what we get
    // This will help us identify if RLS is being applied
    const { data: allSubmissionsTest, error: testError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, user_id, contest_id, created_at')
      .eq('contest_id', contestId)
      .order('created_at', { ascending: false });
    
    if (testError) {
      console.error('[Contest Review API] Test query error:', testError);
    }
    
    console.log('[Contest Review API] Test query results (before joins):', {
      count: allSubmissionsTest?.length || 0,
      userIds: allSubmissionsTest?.map(s => s.user_id) || [],
      uniqueUserIds: [...new Set(allSubmissionsTest?.map(s => s.user_id) || [])],
      submissionIds: allSubmissionsTest?.map(s => s.id) || [],
      expectedCount: totalCount,
      match: allSubmissionsTest?.length === totalCount,
    });
    
    // If test query returns fewer results than count, RLS might be interfering
    if (allSubmissionsTest && totalCount && allSubmissionsTest.length < totalCount) {
      console.warn('[Contest Review API] WARNING: Test query returned fewer results than count! RLS may be interfering.');
      console.warn('[Contest Review API] This suggests the service role is not properly bypassing RLS.');
      console.warn('[Contest Review API] Please ensure migration 031_add_service_role_policy_contest_submissions.sql has been run.');
    }
    
    // IMPORTANT: If we're only getting one user's submissions, there's an RLS issue
    const uniqueUserCount = new Set(allSubmissionsTest?.map(s => s.user_id) || []).size;
    if (uniqueUserCount === 1 && totalCount && totalCount > 1) {
      console.error('[Contest Review API] ERROR: Only seeing submissions from one user!');
      console.error('[Contest Review API] This indicates RLS is filtering results even with service role.');
      console.error('[Contest Review API] Service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
      console.error('[Contest Review API] Attempting to use raw SQL query to bypass RLS...');
      
      // The service role should bypass RLS, but if it's not working, 
      // we need to check if the migration was run or if there's a config issue
      console.error('[Contest Review API] Service role is not bypassing RLS properly.');
      console.error('[Contest Review API] Please verify:');
      console.error('[Contest Review API] 1. Migration 031_add_service_role_policy_contest_submissions.sql has been run');
      console.error('[Contest Review API] 2. SUPABASE_SERVICE_ROLE_KEY is correctly set');
      console.error('[Contest Review API] 3. The service role key has the correct permissions');
    }
    
    // Use the test query results if they exist and match the count
    // This ensures we get all submissions even if the join query has issues
    const submissionsToReturn = allSubmissionsTest && totalCount && allSubmissionsTest.length === totalCount
      ? allSubmissionsTest
      : null;
    
    // CRITICAL FIX: Fetch submissions without joins first to bypass RLS on joined tables
    // Then fetch related data separately and attach manually
    // This ensures we get ALL submissions regardless of RLS on profiles/contests tables
    
    let submissions;
    let error;
    
    // Always use the test query results if available (they bypass RLS on the main table)
    // Then fetch related data separately
    if (allSubmissionsTest && allSubmissionsTest.length > 0) {
      console.log('[Contest Review API] Fetching submissions without joins, then attaching related data separately');
      const submissionIds = allSubmissionsTest.map(s => s.id);
      
      // Fetch all submission data without joins (this should bypass RLS)
      const { data: submissionData, error: submissionError } = await supabaseAdmin
        .from('contest_submissions')
        .select('*')
        .in('id', submissionIds)
        .order('created_at', { ascending: false });
      
      if (submissionError) {
        console.error('[Contest Review API] Error fetching submission data:', submissionError);
        error = submissionError;
        submissions = null;
      } else if (submissionData) {
        // Get unique user IDs and contest IDs
        const userIds = [...new Set(submissionData.map(s => s.user_id))];
        const contestIds = [...new Set(submissionData.map(s => s.contest_id))];
        
        // Fetch profiles separately (service role should bypass RLS)
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email, display_name')
          .in('id', userIds);
        
        // Fetch contest data separately
        const { data: contests } = await supabaseAdmin
          .from('contests')
          .select('id, title, required_hashtags, required_description_template')
          .in('id', contestIds);
        
        // Create maps for quick lookup
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const contestMap = new Map(contests?.map(c => [c.id, c]) || []);
        
        // Attach related data to submissions
        submissions = submissionData.map(sub => ({
          ...sub,
          profiles: profileMap.get(sub.user_id) || null,
          contests: contestMap.get(sub.contest_id) || null,
        }));
        
        console.log('[Contest Review API] Successfully fetched and attached related data:', {
          submissionCount: submissions.length,
          uniqueUsers: userIds.length,
          profilesFound: profiles?.length || 0,
          contestsFound: contests?.length || 0,
        });
      }
    } else {
      // Fallback: Normal query with joins (might be filtered by RLS)
      console.warn('[Contest Review API] Using fallback query with joins (may be filtered by RLS)');
      const result = await supabaseAdmin
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
        .order('created_at', { ascending: false });
      
      submissions = result.data;
      error = result.error;
    }

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
      userIds: submissions?.map(s => s.user_id) || [],
      uniqueUserCount: new Set(submissions?.map(s => s.user_id) || []).size,
      usedTestQuery: !!submissionsToReturn,
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

