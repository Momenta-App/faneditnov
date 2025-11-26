/**
 * Contest-specific ownership validation and collision resolution
 * Handles ownership checks for contest submissions
 */
import { supabaseAdmin } from '@/lib/supabase';
import { createVideoFingerprint } from '@/lib/video-fingerprint';
import type { Platform } from '@/lib/url-utils';

export type ContestOwnershipStatus =
  | { status: 'verified'; socialAccountId: string; reason: string }
  | { status: 'pending'; reason: string }
  | { status: 'failed'; reason: string; claimedBy?: string }
  | { status: 'contested'; reason: string };

/**
 * Check if a video URL is already claimed by a verified user
 * Returns ownership status for contest submission
 */
export async function checkVideoOwnership(
  videoUrl: string,
  userId: string,
  platform: Platform
): Promise<ContestOwnershipStatus> {
  const videoFingerprint = createVideoFingerprint(videoUrl);

  // Check if video is already claimed by a verified social account
  const { data: existingClaims, error: claimsError } = await supabaseAdmin
    .from('raw_video_assets')
    .select(`
      id,
      user_id,
      owner_social_account_id,
      ownership_status,
      social_accounts:owner_social_account_id (
        id,
        user_id,
        username,
        verification_status
      )
    `)
    .eq('video_fingerprint', videoFingerprint)
    .eq('ownership_status', 'verified')
    .limit(1);

  if (claimsError) {
    console.error('[Contest Ownership] Error checking existing claims:', claimsError);
    // Don't fail on error - allow submission to proceed
    return {
      status: 'pending',
      reason: 'Unable to verify ownership status. Please connect your social account.',
    };
  }

  // If video is already claimed by a verified account
  if (existingClaims && existingClaims.length > 0) {
    const claim = existingClaims[0];
    const socialAccount = claim.social_accounts as any;

    // If claimed by the same user, it's verified
    if (claim.user_id === userId || (socialAccount && socialAccount.user_id === userId)) {
      return {
        status: 'verified',
        socialAccountId: claim.owner_social_account_id || '',
        reason: `Ownership verified via connected account @${socialAccount?.username || 'your account'}`,
      };
    }

    // If claimed by a different user, it's failed
    const claimedBy = socialAccount?.username || 'another user';
    return {
      status: 'failed',
      reason: `This video is already claimed by @${claimedBy}. Only the original creator can submit this video.`,
      claimedBy: socialAccount?.user_id || claim.user_id,
    };
  }

  // Check if user has a verified social account that matches this video
  const { data: userAccounts, error: accountsError } = await supabaseAdmin
    .from('social_accounts')
    .select('id, username, platform, verification_status, profile_url')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('verification_status', 'VERIFIED');

  if (accountsError) {
    console.error('[Contest Ownership] Error checking user accounts:', accountsError);
  }

  // If user has verified account, check if it matches the video URL
  if (userAccounts && userAccounts.length > 0) {
    const { username } = extractVideoIdentifiers(videoUrl, platform);
    const normalizedUsername = username?.toLowerCase().replace('@', '');

    for (const account of userAccounts) {
      const accountUsername = account.username?.toLowerCase().replace('@', '');
      if (normalizedUsername && accountUsername === normalizedUsername) {
        return {
          status: 'verified',
          socialAccountId: account.id,
          reason: `Ownership verified via connected account @${account.username}`,
        };
      }

      // Also check profile URL
      if (account.profile_url && videoUrl.includes(account.profile_url)) {
        return {
          status: 'verified',
          socialAccountId: account.id,
          reason: `Ownership verified via connected account @${account.username}`,
        };
      }
    }
  }

  // Check if there are pending/contested submissions for this video
  const { data: pendingSubmissions, error: pendingError } = await supabaseAdmin
    .from('contest_submissions')
    .select('id, user_id, mp4_ownership_status')
    .eq('original_video_url', videoUrl)
    .in('mp4_ownership_status', ['pending', 'contested'])
    .limit(10);

  if (pendingError) {
    console.error('[Contest Ownership] Error checking pending submissions:', pendingError);
  }

  // If there are other pending submissions, mark as contested
  if (pendingSubmissions && pendingSubmissions.length > 0) {
    const otherUsers = pendingSubmissions.filter((s) => s.user_id !== userId);
    if (otherUsers.length > 0) {
      return {
        status: 'contested',
        reason: 'Multiple users have submitted this video. Connect your social account to verify ownership.',
      };
    }
  }

  // Default: pending - user needs to connect account
  return {
    status: 'pending',
    reason: 'Please connect your social account to verify ownership of this video.',
  };
}

/**
 * Resolve ownership conflicts when a social account is verified
 * Fails all competing submissions for the same video
 */
export async function resolveOwnershipConflicts(
  videoUrl: string,
  verifiedAccountId: string,
  verifiedUserId: string
): Promise<void> {
  const videoFingerprint = createVideoFingerprint(videoUrl);

  console.log('[Contest Ownership] Resolving ownership conflicts:', {
    videoUrl,
    verifiedAccountId,
    verifiedUserId,
    videoFingerprint,
  });

  // Get the verified account info
  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('id, username, user_id')
    .eq('id', verifiedAccountId)
    .single();

  if (!account) {
    console.error('[Contest Ownership] Verified account not found:', verifiedAccountId);
    return;
  }

  // Find all contest submissions for this video
  const { data: allSubmissions, error: submissionsError } = await supabaseAdmin
    .from('contest_submissions')
    .select('id, user_id, mp4_ownership_status')
    .eq('original_video_url', videoUrl)
    .in('mp4_ownership_status', ['pending', 'contested']);

  if (submissionsError) {
    console.error('[Contest Ownership] Error finding submissions:', submissionsError);
    return;
  }

  if (!allSubmissions || allSubmissions.length === 0) {
    return;
  }

  // Separate winning and losing submissions
  const winningSubmissionIds: number[] = [];
  const losingSubmissionIds: number[] = [];

  for (const submission of allSubmissions) {
    if (submission.user_id === verifiedUserId) {
      winningSubmissionIds.push(submission.id);
    } else {
      losingSubmissionIds.push(submission.id);
    }
  }

  // Update winning submissions
  if (winningSubmissionIds.length > 0) {
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        mp4_ownership_status: 'verified',
        mp4_owner_social_account_id: verifiedAccountId,
        mp4_ownership_reason: `Ownership verified for @${account.username || 'your account'}`,
        verification_status: 'verified',
        ownership_resolved_at: new Date().toISOString(),
      })
      .in('id', winningSubmissionIds);

    console.log('[Contest Ownership] Updated winning submissions:', winningSubmissionIds);
  }

  // Update losing submissions
  if (losingSubmissionIds.length > 0) {
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        mp4_ownership_status: 'failed',
        mp4_ownership_reason: `Ownership claimed by @${account.username || 'another creator'}. Only the original creator can submit this video.`,
        verification_status: 'failed',
        ownership_resolved_at: new Date().toISOString(),
        is_disqualified: true,
      })
      .in('id', losingSubmissionIds);

    console.log('[Contest Ownership] Updated losing submissions:', losingSubmissionIds);
  }

  // Also update raw_video_assets
  const { data: assets } = await supabaseAdmin
    .from('raw_video_assets')
    .select('id, user_id, contest_submission_id')
    .eq('video_fingerprint', videoFingerprint)
    .in('ownership_status', ['pending', 'contested']);

  if (assets && assets.length > 0) {
    const winningAssetIds: string[] = [];
    const losingAssetIds: string[] = [];

    for (const asset of assets) {
      if (asset.user_id === verifiedUserId) {
        winningAssetIds.push(asset.id);
      } else {
        losingAssetIds.push(asset.id);
      }
    }

    if (winningAssetIds.length > 0) {
      await supabaseAdmin
        .from('raw_video_assets')
        .update({
          ownership_status: 'verified',
          owner_social_account_id: verifiedAccountId,
          ownership_verified_at: new Date().toISOString(),
          ownership_reason: 'Ownership verified via connected account',
        })
        .in('id', winningAssetIds);
    }

    if (losingAssetIds.length > 0) {
      await supabaseAdmin
        .from('raw_video_assets')
        .update({
          ownership_status: 'failed',
          ownership_reason: `Ownership claimed by @${account.username || 'verified creator'}`,
        })
        .in('id', losingAssetIds);
    }
  }
}

/**
 * Extract username from video URL for platform-specific matching
 */
function extractVideoIdentifiers(
  standardizedUrl: string,
  platform: Platform
): { username?: string; videoId?: string } {
  const result: { username?: string; videoId?: string } = {};
  try {
    const urlObj = new URL(standardizedUrl);
    if (platform === 'tiktok') {
      const match = urlObj.pathname.match(/\/@([^/]+)\/video\/(\d+)/);
      if (match) {
        result.username = match[1];
        result.videoId = match[2];
      }
    } else if (platform === 'instagram') {
      const match = urlObj.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (match) {
        result.videoId = match[2];
      }
      const userMatch = urlObj.pathname.match(/\/([^/]+)\/(p|reel)\//);
      if (userMatch) {
        result.username = userMatch[1];
      }
    } else if (platform === 'youtube') {
      const match = urlObj.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (match) {
        result.videoId = match[1];
      }
      const channelMatch = urlObj.pathname.match(/\/@([^/]+)/);
      if (channelMatch) {
        result.username = channelMatch[1];
      }
    }
  } catch (err) {
    // Ignore URL parse errors
  }
  return result;
}

