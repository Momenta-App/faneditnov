/**
 * Admin API route for updating contest submission review status
 * GET: Get a single submission for review
 * PUT: Update submission review statuses
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/review/submissions/[submissionId]
 * Get a single submission for review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, submissionId } = await params;

    const { data: submission, error } = await supabaseAdmin
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
      .eq('id', parseInt(submissionId, 10))
      .eq('contest_id', contestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: submission });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Review API] Error fetching submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/contests/[id]/review/submissions/[submissionId]
 * Update submission review statuses
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id: contestId, submissionId } = await params;

    console.log('[Contest Review API] PUT request:', { contestId, submissionId });

    const body = await request.json();
    const { hashtag_status, description_status, content_review_status } = body;
    
    console.log('[Contest Review API] Update body:', { hashtag_status, description_status, content_review_status });

    // Verify submission belongs to contest
    // Convert submissionId to number if it's a string
    const submissionIdNum = parseInt(submissionId, 10);
    if (isNaN(submissionIdNum)) {
      return NextResponse.json(
        { error: 'Invalid submission ID' },
        { status: 400 }
      );
    }

    console.log('[Contest Review API] Parsed submissionId:', submissionIdNum);

    const { data: existingSubmission } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, contest_id')
      .eq('id', submissionIdNum)
      .single();

    if (!existingSubmission || existingSubmission.contest_id !== contestId) {
      return NextResponse.json(
        { error: 'Submission not found in this contest' },
        { status: 404 }
      );
    }

    // First, get the current state BEFORE building updates
    const { data: beforeUpdate, error: beforeError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, content_review_status, hashtag_status, description_status, processing_status')
      .eq('id', submissionIdNum)
      .single();
    console.log('[Contest Review API] Before update - content_review_status:', beforeUpdate?.content_review_status);
    
    if (beforeError) {
      console.error('[Contest Review API] Error fetching before update:', beforeError);
      if (beforeError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      throw beforeError;
    }

    // Log the state transition
    const stateTransition = beforeUpdate?.content_review_status 
      ? `${beforeUpdate.content_review_status} → ${content_review_status || 'unchanged'}`
      : 'unknown → ' + (content_review_status || 'unchanged');
    console.log('[Contest Review API] ===== STATE TRANSITION =====');
    console.log('[Contest Review API] Transition:', stateTransition);
    console.log('[Contest Review API] Before state:', JSON.stringify(beforeUpdate, null, 2));
    console.log('[Contest Review API] Current processing_status:', beforeUpdate?.processing_status);
    
    // Build updates object (keep logic local so we can reuse existing, working path)
    const updates: Record<string, string> = {};
    if (hashtag_status) {
      updates.hashtag_status = hashtag_status;
    }
    if (description_status) {
      updates.description_status = description_status;
    }
    
    let shouldUpdateProcessingStatus = false;
    let nextProcessingStatus: string | null = null;
    
    if (content_review_status) {
      updates.content_review_status = content_review_status;
      
      if (
        beforeUpdate?.content_review_status === 'approved' &&
        (content_review_status === 'pending' || content_review_status === 'rejected')
      ) {
        shouldUpdateProcessingStatus = true;
        nextProcessingStatus = 'waiting_review';
      } else if (content_review_status === 'approved' && beforeUpdate) {
        const hashtagPass =
          beforeUpdate.hashtag_status === 'pass' ||
          beforeUpdate.hashtag_status === 'approved_manual';
        const descriptionPass =
          beforeUpdate.description_status === 'pass' ||
          beforeUpdate.description_status === 'approved_manual';
        
        if (hashtagPass && descriptionPass) {
          shouldUpdateProcessingStatus = true;
          nextProcessingStatus = 'approved';
        }
      }
    }
    
    if (shouldUpdateProcessingStatus && nextProcessingStatus) {
      updates.processing_status = nextProcessingStatus;
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }
    
    console.log('[Contest Review API] Executing direct update with:', updates);
    const updateStartTime = Date.now();
    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from('contest_submissions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', submissionIdNum)
      .select('id, content_review_status, hashtag_status, description_status, processing_status, updated_at')
      .single();
    const updateDuration = Date.now() - updateStartTime;
    
    console.log('[Contest Review API] Update completed in', updateDuration, 'ms');
    
    if (updateError || !updatedRow) {
      console.error('[Contest Review API] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission', details: updateError?.message },
        { status: 500 }
      );
    }
    
    // Verify the update actually persisted by querying again
    console.log('[Contest Review API] Executing verification query...');
    const verifyStartTime = Date.now();
    const { data: verifyUpdate, error: verifyError } = await supabaseAdmin
      .from('contest_submissions')
      .select('id, content_review_status, processing_status, updated_at, hashtag_status, description_status')
      .eq('id', submissionIdNum)
      .single();
    const verifyDuration = Date.now() - verifyStartTime;
    
    console.log('[Contest Review API] Verification query completed in', verifyDuration, 'ms');
    console.log('[Contest Review API] Verification query result:', verifyUpdate);
    console.log('[Contest Review API] Verification query error:', verifyError);
    
    // Compare update response with verification query
    let updatePersisted = true;
    if (updatedRow && verifyUpdate) {
      console.log('[Contest Review API] Comparing update response with verification query:');
      const fieldsToCompare = ['content_review_status', 'processing_status', 'hashtag_status', 'description_status'];
      for (const field of fieldsToCompare) {
        const updateValue = (updatedRow as any)[field];
        const verifyValue = (verifyUpdate as any)[field];
        const matches = updateValue === verifyValue;
        console.log(`[Contest Review API]   ${field}: update_response=${updateValue}, verification=${verifyValue}, match=${matches}`);
        if (!matches) {
          console.error(`[Contest Review API] ERROR: Mismatch for ${field}!`);
          updatePersisted = false;
        }
      }
    }
    
    // Final summary log
    console.log('[Contest Review API] ===== UPDATE SUMMARY =====');
    console.log('[Contest Review API] Submission ID:', submissionIdNum);
    console.log('[Contest Review API] Updates requested:', JSON.stringify({ hashtag_status, description_status, content_review_status }, null, 2));
    console.log('[Contest Review API] Before state:', JSON.stringify(beforeUpdate, null, 2));
    console.log('[Contest Review API] Update response:', JSON.stringify(updatedRow, null, 2));
    console.log('[Contest Review API] Verification query:', JSON.stringify(verifyUpdate, null, 2));
    console.log('[Contest Review API] Update persisted:', updatePersisted);
    console.log('[Contest Review API] ===========================');
    
    return NextResponse.json({ 
      data: updatedRow,
      beforeUpdate: beforeUpdate?.content_review_status,
      afterUpdate: updatedRow.content_review_status,
      verified: verifyUpdate,
      updatePersisted: updatePersisted
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Contest Review API] Error updating submission:', error);
    console.error('[Contest Review API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Contest Review API] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Extract error message
    let errorMessage = 'Failed to update submission';
    let errorDetails = null;
    
    if (error instanceof Error) {
      errorMessage = error.message || errorMessage;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      errorMessage = errorObj.message || errorObj.error || errorMessage;
      errorDetails = {
        code: errorObj.code,
        message: errorObj.message,
        details: errorObj.details,
        hint: errorObj.hint
      };
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

