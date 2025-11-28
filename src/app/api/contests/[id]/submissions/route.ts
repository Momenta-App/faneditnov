/**
 * Public API route for contest submissions
 * POST: Create submission (logged in only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform, standardizeUrl, isValidUrl } from '@/lib/url-utils';
import { resolveAccountOwnership } from '@/lib/video-ownership';
import { storeRawVideoAsset, upsertOwnershipClaim } from '@/lib/raw-video-assets';
import { createVideoFingerprint } from '@/lib/video-fingerprint';
import { checkVideoOwnership } from '@/lib/contest-ownership';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contests/[id]/submissions
 * Create a new submission to a contest
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uploadedAsset: { assetId: string; storagePath: string; bucket: string } | null = null;
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Check if id is a valid UUID (format: 8-4-4-4-12 hex characters)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Build query - support both UUID and slug lookups
    let query = supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          is_general,
          ranking_method
        )
      `);

    // Query by UUID or slug
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data: contest, error: contestError } = await query.single();

    if (contestError) {
      if (contestError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

    if (!contest) {
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

    // Get the actual contest ID (in case we looked up by slug)
    const contestId = contest.id;

    // Check if contest is live
    if (contest.status !== 'live') {
      return NextResponse.json(
        { error: 'Contest is not currently accepting submissions' },
        { status: 400 }
      );
    }

    // Parse form data (multipart/form-data)
    const formData = await request.formData();
    const videoUrl = formData.get('video_url') as string;
    const mp4File = formData.get('mp4_file') as File | null;
    
    // Get all category_ids (can be multiple)
    const categoryIds = formData.getAll('category_ids') as string[];
    const categoryId = formData.get('category_id') as string | null; // Legacy support

    // Validate categories
    const categories = contest.contest_categories || [];
    const specificCategories = categories.filter((cat: any) => cat.is_general === false);
    const generalCategories = categories.filter((cat: any) => cat.is_general === true);
    
    // Use categoryIds if provided, otherwise fall back to categoryId for legacy support
    const selectedCategoryIds = categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : []);
    
    // Validate: category selection is only required if no general categories exist
    if (specificCategories.length > 0 && generalCategories.length === 0 && selectedCategoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Category selection is required for this contest' },
        { status: 400 }
      );
    }

    // Validate all selected categories belong to this contest and are not general
    const invalidCategories = selectedCategoryIds.filter(
      (id) => !specificCategories.some((cat: any) => cat.id === id)
    );
    if (invalidCategories.length > 0) {
      return NextResponse.json(
        { error: 'Invalid category selected' },
        { status: 400 }
      );
    }

    // Validate single category if force_single_category is enabled
    if (contest.force_single_category && selectedCategoryIds.length > 1) {
      return NextResponse.json(
        { error: 'You can only select one category for this contest' },
        { status: 400 }
      );
    }

    // Primary category is the first selected category (or null if none selected)
    const validatedCategoryId = selectedCategoryIds.length > 0 ? selectedCategoryIds[0] : null;
    
    // All categories to associate with submission: selected + general
    const allCategoryIds = [
      ...selectedCategoryIds,
      ...generalCategories.map((cat: any) => cat.id)
    ];

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    if (!mp4File) {
      return NextResponse.json(
        { error: 'MP4 file is required' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!isValidUrl(videoUrl)) {
      return NextResponse.json(
        { error: 'Invalid video URL. Must be TikTok, Instagram, or YouTube Shorts' },
        { status: 400 }
      );
    }

    // Standardize URL
    const standardizedUrl = standardizeUrl(videoUrl);
    const platform = detectPlatform(standardizedUrl);

    if (platform === 'unknown') {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Extract video ID and username from URL
    let videoId = '';
    try {
      const urlObj = new URL(standardizedUrl);
      if (platform === 'tiktok') {
        const match = urlObj.pathname.match(/\/@([^\/]+)\/video\/(\d+)/);
        if (match) {
          videoId = match[2];
        }
      } else if (platform === 'instagram') {
        const match = urlObj.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
        videoId = match ? match[2] : '';
        // Extract username from URL if available
      } else if (platform === 'youtube') {
        const match = urlObj.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
        videoId = match ? match[1] : '';
      }
    } catch (err) {
      // Continue with empty videoId - will be extracted in processing
    }

    const resolvedPlatform = platform as 'tiktok' | 'instagram' | 'youtube';
    const ownership = await resolveAccountOwnership({
      userId: user.id,
      platform: resolvedPlatform,
      standardizedUrl,
      requireVerified: false,
    });

    const matchedAccountId = ownership.account?.id ?? null;
    const isOwnershipVerified = ownership.status === 'verified';

    // Check for duplicate submission
    // Check if this video URL has already been submitted to this contest by this user
    // We check across all categories using both the junction table and legacy category_id field
    const { data: existingSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        id,
        category_id,
        contest_submission_categories (
          category_id
        )
      `)
      .eq('contest_id', contestId)
      .eq('user_id', user.id)
      .eq('original_video_url', standardizedUrl);

    if (existingSubmissions && existingSubmissions.length > 0) {
      // Collect all category IDs from existing submissions (both junction table and legacy category_id)
      const existingCategoryIds = new Set<string>();
      existingSubmissions.forEach((sub: any) => {
        // Add category_id if it exists (legacy support)
        if (sub.category_id) {
          existingCategoryIds.add(sub.category_id);
        }
        // Add categories from junction table
        if (sub.contest_submission_categories) {
          sub.contest_submission_categories.forEach((csc: any) => {
            if (csc.category_id) {
              existingCategoryIds.add(csc.category_id);
            }
          });
        }
      });
      
      // Check if any of the selected categories overlap with existing submissions
      const overlappingCategories = selectedCategoryIds.filter((id) => existingCategoryIds.has(id));
      
      if (overlappingCategories.length > 0) {
        return NextResponse.json(
          { error: 'You have already submitted this video to one or more of the selected categories' },
          { status: 400 }
        );
      }
      
      // If no specific categories selected but general categories exist, check if submission exists
      // This prevents duplicate submissions when only general categories are available
      if (selectedCategoryIds.length === 0 && generalCategories.length > 0) {
        // Check if there's already a submission with only general categories (or no specific categories)
        const hasSubmissionWithOnlyGeneralCategories = existingSubmissions.some((sub: any) => {
          const subCategoryIds = new Set<string>();
          if (sub.category_id) {
            subCategoryIds.add(sub.category_id);
          }
          if (sub.contest_submission_categories) {
            sub.contest_submission_categories.forEach((csc: any) => {
              if (csc.category_id) {
                subCategoryIds.add(csc.category_id);
              }
            });
          }
          
          // If submission has no categories or only general categories, it's a duplicate
          if (subCategoryIds.size === 0) {
            return true; // No categories = general only
          }
          
          // Check if all categories are general
          return Array.from(subCategoryIds).every((id: string) => 
            generalCategories.some((gc: any) => gc.id === id)
          );
        });
        
        if (hasSubmissionWithOnlyGeneralCategories) {
          return NextResponse.json(
            { error: 'You have already submitted this video to this contest' },
            { status: 400 }
          );
        }
      }
    }

    // Check if same video URL exists in another contest for same movie using database function
    const { data: hasDuplicate, error: duplicateCheckError } = await supabaseAdmin
      .rpc('check_duplicate_video_across_movie_contests', {
        p_user_id: user.id,
        p_video_url: standardizedUrl,
        p_contest_id: contestId,
      });

    if (duplicateCheckError) {
      console.error('Error checking duplicate:', duplicateCheckError);
      // Fallback to manual check
      if (contest.movie_identifier) {
        const { data: otherContests } = await supabaseAdmin
          .from('contests')
          .select('id')
          .eq('movie_identifier', contest.movie_identifier)
          .neq('id', contestId);

        if (otherContests && otherContests.length > 0) {
          const otherContestIds = otherContests.map((c) => c.id);
          const { data: duplicateInOtherContest } = await supabaseAdmin
            .from('contest_submissions')
            .select('id, contest_id')
            .eq('user_id', user.id)
            .eq('original_video_url', standardizedUrl)
            .in('contest_id', otherContestIds)
            .maybeSingle();

          if (duplicateInOtherContest) {
            return NextResponse.json(
              { error: 'This video has already been submitted to another contest for this movie' },
              { status: 400 }
            );
          }
        }
      }
    } else if (hasDuplicate === true) {
      return NextResponse.json(
        { error: 'This video has already been submitted to another contest for this movie' },
        { status: 400 }
      );
    }

    // Check video ownership using new contest ownership logic
    const ownershipCheck = await checkVideoOwnership(
      standardizedUrl,
      user.id,
      resolvedPlatform
    );

    console.log('[Submission Creation] Ownership check result:', {
      videoUrl: standardizedUrl,
      userId: user.id,
      platform: resolvedPlatform,
      ownershipStatus: ownershipCheck.status,
    });

    // If ownership check failed (video claimed by different user), reject submission
    if (ownershipCheck.status === 'failed') {
      return NextResponse.json(
        { error: ownershipCheck.reason },
        { status: 409 }
      );
    }

    // Map ownership check status to submission statuses
    let mp4OwnershipStatus: 'pending' | 'verified' | 'contested' | 'failed';
    let ownershipClaimStatus: 'pending' | 'claimed' | 'contested';
    let mp4OwnershipReason: string | null = ownershipCheck.reason;
    let verifiedOwnershipAccountId: string | null = null;

    if (ownershipCheck.status === 'verified') {
      mp4OwnershipStatus = 'verified';
      ownershipClaimStatus = 'claimed';
      verifiedOwnershipAccountId = ownershipCheck.socialAccountId;
    } else if (ownershipCheck.status === 'contested') {
      mp4OwnershipStatus = 'contested';
      ownershipClaimStatus = 'contested';
    } else {
      // pending
      mp4OwnershipStatus = 'pending';
      ownershipClaimStatus = 'pending';
    }

    const ownershipContestedAt =
      mp4OwnershipStatus === 'contested' ? new Date().toISOString() : null;
    const ownershipResolvedAt =
      mp4OwnershipStatus === 'verified' ? new Date().toISOString() : null;

    uploadedAsset = await storeRawVideoAsset({
      userId: user.id,
      platform: resolvedPlatform,
      standardizedUrl,
      mp4File,
      submissionType: 'contest',
      contestId,
      ownershipStatus:
        mp4OwnershipStatus === 'verified'
          ? 'verified'
          : mp4OwnershipStatus === 'contested'
          ? 'contested'
          : 'pending',
      ownerSocialAccountId: matchedAccountId,
      ownershipReason: mp4OwnershipReason,
    });

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .insert({
        contest_id: contestId,
        category_id: validatedCategoryId, // Primary category for backward compatibility
        user_id: user.id,
        social_account_id: matchedAccountId,
        original_video_url: standardizedUrl,
        platform: resolvedPlatform,
        video_id: videoId || null,
        processing_status: 'uploaded',
        hashtag_status: 'pending_review',
        description_status: 'pending_review',
        content_review_status: 'pending',
        verification_status: mp4OwnershipStatus === 'verified' ? 'verified' : 'pending',
        mp4_bucket: uploadedAsset.bucket,
        mp4_path: uploadedAsset.storagePath,
        raw_video_asset_id: uploadedAsset.assetId,
        mp4_ownership_status: mp4OwnershipStatus,
        mp4_ownership_reason: mp4OwnershipReason,
        mp4_owner_social_account_id: verifiedOwnershipAccountId,
        mp4_uploaded_by_user_id: user.id,
        ownership_contested_at: ownershipContestedAt,
        ownership_resolved_at: ownershipResolvedAt,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      if (uploadedAsset) {
        await supabaseAdmin.storage.from(uploadedAsset.bucket).remove([uploadedAsset.storagePath]).catch(() => {});
        await supabaseAdmin.from('raw_video_assets').delete().eq('id', uploadedAsset.assetId);
      }
      throw submissionError || new Error('Failed to create submission');
    }

    // Create entries in contest_submission_categories for all categories
    // User-selected categories have is_primary=true, general categories have is_primary=false
    if (allCategoryIds.length > 0) {
      const submissionCategoryEntries = allCategoryIds.map((categoryId) => ({
        submission_id: submission.id,
        category_id: categoryId,
        is_primary: selectedCategoryIds.includes(categoryId), // true for user-selected, false for general
      }));

      const { error: categoryLinkError } = await supabaseAdmin
        .from('contest_submission_categories')
        .insert(submissionCategoryEntries);

      if (categoryLinkError) {
        console.error('[Submission Creation] Failed to link categories:', categoryLinkError);
        // Don't fail the submission if category linking fails - it's not critical
        // The primary category_id is still set on the submission
      }
    }

    // Create submission_metadata record for main ingestion pipeline
    // This allows the main webhook to process the submission through full ingestion
    const placeholderSnapshotId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: metadataError } = await supabaseAdmin
      .from('submission_metadata')
      .insert({
        snapshot_id: placeholderSnapshotId,
        video_urls: [standardizedUrl],
        skip_validation: false, // Contest submissions always require validation
        submitted_by: user.id,
      });

    if (metadataError) {
      console.error('[Submission Creation] Failed to create submission_metadata:', metadataError);
      // Don't fail the submission if metadata creation fails - it's not critical
      // The contest webhook will still work, but full ingestion may not happen
    } else {
      console.log('[Submission Creation] Created submission_metadata for full ingestion:', {
        submissionId: submission.id,
        placeholderSnapshotId,
      });
    }

    // Update raw_video_assets to link to both contest_submission_id and submission_metadata_id
    await supabaseAdmin
      .from('raw_video_assets')
      .update({ 
        contest_submission_id: submission.id,
        submission_metadata_id: placeholderSnapshotId,
      })
      .eq('id', uploadedAsset.assetId);

    await upsertOwnershipClaim({
      standardizedUrl,
      platform: resolvedPlatform,
      assetId: uploadedAsset.assetId,
      userId: user.id,
      socialAccountId: verifiedOwnershipAccountId,
      status: ownershipClaimStatus,
    });

    // NOTE: BrightData trigger is handled by process-submission route
    // This prevents duplicate triggers - process-submission will trigger BrightData with contest-webhook
    // The placeholder snapshot_id in submission_metadata allows process-submission to detect this submission
    console.log('[Submission Creation] Skipping BrightData trigger - will be handled by process-submission route:', {
      submissionId: submission.id,
      placeholderSnapshotId,
      note: 'process-submission will trigger BrightData with contest-webhook',
    });

    // Trigger background job for stats retrieval
    // This is fire-and-forget - submission is already created, processing happens async
    const processSubmissionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contests/process-submission`;
    console.log('[Submission Creation] Triggering background processing:', {
      submissionId: submission.id,
      url: processSubmissionUrl,
    });

    fetch(processSubmissionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('[Submission Creation] Background job failed:', {
            submissionId: submission.id,
            status: response.status,
            error: errorText,
          });
        } else {
          const result = await response.json().catch(() => ({}));
          console.log('[Submission Creation] Background job triggered successfully:', {
            submissionId: submission.id,
            snapshotId: result.snapshot_id,
          });
        }
      })
      .catch((err) => {
        // Don't fail submission if background job fails - it can be retried manually
        console.error('[Submission Creation] Error triggering background processing:', {
          submissionId: submission.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return NextResponse.json({
      data: submission,
    }, { status: 201 });
  } catch (error) {
    if (uploadedAsset) {
      await supabaseAdmin.storage.from(uploadedAsset.bucket).remove([uploadedAsset.storagePath]).catch(() => {});
      await supabaseAdmin.from('raw_video_assets').delete().eq('id', uploadedAsset.assetId);
      uploadedAsset = null;
    }

    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating submission:', error);
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    );
  }
}

