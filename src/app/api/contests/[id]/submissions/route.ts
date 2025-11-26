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
    const { id: contestId } = await params;

    // Get contest with categories (including general categories)
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          is_general,
          ranking_method
        )
      `)
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

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
    const categoryId = formData.get('category_id') as string | null;

    // Validate category if contest has specific (non-general) categories
    const categories = contest.contest_categories || [];
    const specificCategories = categories.filter((cat: any) => !cat.is_general);
    const generalCategories = categories.filter((cat: any) => cat.is_general);
    let validatedCategoryId: string | null = null;

    if (specificCategories.length > 0) {
      // Contest has specific categories - category_id is required
      if (!categoryId) {
        return NextResponse.json(
          { error: 'Category selection is required for this contest' },
          { status: 400 }
        );
      }

      // Validate category belongs to this contest and is not general
      const categoryExists = specificCategories.some((cat: any) => cat.id === categoryId);
      if (!categoryExists) {
        return NextResponse.json(
          { error: 'Invalid category selected' },
          { status: 400 }
        );
      }

      validatedCategoryId = categoryId;
    }
    // If no specific categories, categoryId remains null (submission goes to contest directly)
    // General categories will be auto-assigned via trigger

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

    // Check for duplicate submission (within same category if categories exist)
    const duplicateQuery = supabaseAdmin
      .from('contest_submissions')
      .select('id')
      .eq('contest_id', contestId)
      .eq('user_id', user.id)
      .eq('original_video_url', standardizedUrl);

    // Include category_id in duplicate check if categories exist
    if (validatedCategoryId) {
      duplicateQuery.eq('category_id', validatedCategoryId);
    } else {
      duplicateQuery.is('category_id', null);
    }

    const { data: existingSubmission } = await duplicateQuery.maybeSingle();

    if (existingSubmission) {
      const errorMsg = validatedCategoryId
        ? 'You have already submitted this video to this category'
        : 'You have already submitted this video to this contest';
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
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

    const videoFingerprint = createVideoFingerprint(standardizedUrl);
    const { data: existingClaim } = await supabaseAdmin
      .from('video_ownership_claims')
      .select('video_fingerprint, status, current_owner_user_id, current_owner_social_account_id')
      .eq('video_fingerprint', videoFingerprint)
      .maybeSingle();

    const hasVerifiedOwner =
      existingClaim &&
      existingClaim.status === 'claimed' &&
      existingClaim.current_owner_user_id &&
      existingClaim.current_owner_user_id !== user.id;

    if (hasVerifiedOwner) {
      return NextResponse.json(
        { error: 'This video has already been uploaded by the verified owner.' },
        { status: 409 }
      );
    }

    const alreadyClaimedByUser =
      existingClaim &&
      existingClaim.status === 'claimed' &&
      existingClaim.current_owner_user_id === user.id;

    let mp4OwnershipStatus: 'pending' | 'verified' | 'contested';
    let ownershipClaimStatus: 'pending' | 'claimed' | 'contested';
    let mp4OwnershipReason: string | null = null;

    if (isOwnershipVerified || alreadyClaimedByUser) {
      mp4OwnershipStatus = 'verified';
      ownershipClaimStatus = 'claimed';
      mp4OwnershipReason = 'Ownership verified for your connected account.';
    } else if (existingClaim) {
      mp4OwnershipStatus = 'contested';
      ownershipClaimStatus = 'contested';
      mp4OwnershipReason =
        'Another creator has also submitted this video. Ownership will be assigned once the correct account is verified.';
    } else if (matchedAccountId) {
      mp4OwnershipStatus = 'pending';
      ownershipClaimStatus = 'pending';
      mp4OwnershipReason = 'Verify this connected account to finalize ownership.';
    } else {
      mp4OwnershipStatus = 'pending';
      ownershipClaimStatus = 'pending';
      mp4OwnershipReason = 'Connect the matching social account to finalize ownership.';
    }

    const ownershipContestedAt =
      mp4OwnershipStatus === 'contested' ? new Date().toISOString() : null;
    const ownershipResolvedAt =
      mp4OwnershipStatus === 'verified' ? new Date().toISOString() : null;
    const verifiedOwnershipAccountId =
      mp4OwnershipStatus === 'verified'
        ? matchedAccountId ?? existingClaim?.current_owner_social_account_id ?? null
        : null;

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
        category_id: validatedCategoryId,
        user_id: user.id,
        social_account_id: matchedAccountId,
        original_video_url: standardizedUrl,
        platform: resolvedPlatform,
        video_id: videoId || null,
        processing_status: 'uploaded',
        hashtag_status: 'pending_review',
        description_status: 'pending_review',
        content_review_status: 'pending',
        verification_status: isOwnershipVerified || alreadyClaimedByUser ? 'verified' : 'pending',
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

    await supabaseAdmin
      .from('raw_video_assets')
      .update({ contest_submission_id: submission.id })
      .eq('id', uploadedAsset.assetId);

    await upsertOwnershipClaim({
      standardizedUrl,
      platform: resolvedPlatform,
      assetId: uploadedAsset.assetId,
      userId: user.id,
      socialAccountId: verifiedOwnershipAccountId,
      status: ownershipClaimStatus,
    });

    // Trigger background job for stats retrieval
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contests/process-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id }),
      }).catch((err) => {
        // Don't fail submission if background job fails
        console.error('Failed to trigger background processing:', err);
      });
    } catch (err) {
      // Continue anyway - background job can be retried
      console.error('Error triggering background processing:', err);
    }

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

