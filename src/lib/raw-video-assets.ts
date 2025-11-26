import { supabaseAdmin } from '@/lib/supabase';
import { createVideoFingerprint } from '@/lib/video-fingerprint';
import { SocialAccountRecord, accountMatchesUrl } from '@/lib/video-ownership';

type Platform = 'tiktok' | 'instagram' | 'youtube';
type OwnershipStatus = 'pending' | 'verified' | 'failed' | 'contested' | 'not_required';

const RAW_VIDEO_BUCKET = 'contest-videos';

export async function storeRawVideoAsset(options: {
  userId: string;
  platform: Platform;
  standardizedUrl: string;
  mp4File: File;
  submissionType: 'contest' | 'general';
  contestId?: string;
  contestSubmissionId?: number | null;
  submissionMetadataId?: string | null;
  ownershipStatus: OwnershipStatus;
  ownerSocialAccountId?: string | null;
  ownershipReason?: string | null;
}): Promise<{
  assetId: string;
  storagePath: string;
  bucket: string;
}> {
  const {
    userId,
    platform,
    standardizedUrl,
    mp4File,
    submissionType,
    contestId,
    contestSubmissionId,
    submissionMetadataId,
    ownershipStatus,
    ownerSocialAccountId,
    ownershipReason,
  } = options;

  const sanitizedFilename = mp4File.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const timestamp = Date.now();
  const prefix =
    submissionType === 'contest' && contestId
      ? `${contestId}`
      : `general`;
  const storagePath = `${prefix}/${userId}/${timestamp}-${sanitizedFilename}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(RAW_VIDEO_BUCKET)
    .upload(storagePath, mp4File, {
      cacheControl: '3600',
      upsert: false,
      contentType: mp4File.type || 'video/mp4',
    });

  if (uploadError) {
    throw new Error(`Failed to upload MP4: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabaseAdmin
    .from('raw_video_assets')
    .insert({
      user_id: userId,
      submission_type: submissionType,
      contest_submission_id: submissionType === 'contest' ? contestSubmissionId ?? null : null,
      submission_metadata_id: submissionMetadataId ?? null,
      video_url: standardizedUrl,
      platform,
      mp4_bucket: RAW_VIDEO_BUCKET,
      mp4_path: storagePath,
      mp4_size_bytes: typeof mp4File.size === 'number' ? mp4File.size : null,
      ownership_status: ownershipStatus,
      owner_social_account_id: ownerSocialAccountId ?? null,
      ownership_verified_at: ownershipStatus === 'verified' ? new Date().toISOString() : null,
      ownership_reason: ownershipReason ?? null,
    })
    .select('id')
    .single();

  if (insertError || !data) {
    await supabaseAdmin.storage.from(RAW_VIDEO_BUCKET).remove([storagePath]);
    throw new Error(insertError?.message || 'Failed to persist MP4 metadata');
  }

  return {
    assetId: data.id,
    storagePath,
    bucket: RAW_VIDEO_BUCKET,
  };
}

type ClaimStatus = 'claimed' | 'contested' | 'pending' | 'unclaimed';

export async function upsertOwnershipClaim(options: {
  standardizedUrl: string;
  platform: Platform;
  assetId: string;
  userId: string;
  socialAccountId?: string | null;
  status: ClaimStatus;
}) {
  const { standardizedUrl, platform, assetId, userId, socialAccountId, status } = options;
  const fingerprint = createVideoFingerprint(standardizedUrl);

  const { data: existingClaim } = await supabaseAdmin
    .from('video_ownership_claims')
    .select('*')
    .eq('video_fingerprint', fingerprint)
    .maybeSingle();

  if (!existingClaim) {
    await supabaseAdmin.from('video_ownership_claims').insert({
      video_fingerprint: fingerprint,
      platform,
      current_owner_asset_id: status === 'claimed' ? assetId : null,
      current_owner_user_id: status === 'claimed' ? userId : null,
      current_owner_social_account_id: status === 'claimed' ? socialAccountId ?? null : null,
      status: status === 'unclaimed' ? 'unclaimed' : status,
      contested_count: status === 'contested' ? 1 : 0,
      last_contested_at: status === 'contested' ? new Date().toISOString() : null,
    });
    return;
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (status === 'claimed') {
    updatePayload.status = 'claimed';
    updatePayload.current_owner_asset_id = assetId;
    updatePayload.current_owner_user_id = userId;
    updatePayload.current_owner_social_account_id = socialAccountId ?? null;
    updatePayload.contested_count = existingClaim.contested_count || 0;
  } else if (status === 'contested') {
    updatePayload.status = existingClaim.status === 'claimed' ? 'claimed' : 'contested';
    updatePayload.contested_count = (existingClaim.contested_count || 0) + 1;
    updatePayload.last_contested_at = new Date().toISOString();
  } else if (status === 'pending' && existingClaim.status === 'unclaimed') {
    updatePayload.status = 'pending';
  }

  await supabaseAdmin
    .from('video_ownership_claims')
    .update(updatePayload)
    .eq('video_fingerprint', fingerprint);
}

export async function associateAccountWithPendingAssets(accountId: string) {
  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('id, user_id, platform, username, profile_url, verification_status')
    .eq('id', accountId)
    .maybeSingle();

  if (!account) return;
  const platform = account.platform as Platform;

  const { data: assets } = await supabaseAdmin
    .from('raw_video_assets')
    .select('id, video_url, contest_submission_id, platform, user_id')
    .eq('user_id', account.user_id)
    .eq('platform', platform)
    .is('owner_social_account_id', null);

  const matchingAssetIds =
    assets
      ?.filter((asset) => accountMatchesUrl(account as SocialAccountRecord, asset.video_url, platform))
      .map((asset) => asset.id) || [];

  if (matchingAssetIds.length > 0) {
    await supabaseAdmin
      .from('raw_video_assets')
      .update({
        owner_social_account_id: account.id,
        ownership_reason: 'Linked to connected account',
      })
      .in('id', matchingAssetIds);

    await supabaseAdmin
      .from('contest_submissions')
      .update({
        social_account_id: account.id,
        mp4_ownership_reason: 'Account linked, pending verification',
        mp4_uploaded_by_user_id: account.user_id,
      })
      .in('raw_video_asset_id', matchingAssetIds);
  }

  const { data: pendingSubmissions } = await supabaseAdmin
    .from('contest_submissions')
    .select('id, original_video_url')
    .eq('user_id', account.user_id)
    .eq('platform', platform)
    .is('social_account_id', null);

  const matchedSubmissionIds =
    pendingSubmissions
      ?.filter((submission) =>
        accountMatchesUrl(account as SocialAccountRecord, submission.original_video_url, platform)
      )
      .map((submission) => submission.id) || [];

  if (matchedSubmissionIds.length > 0) {
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        social_account_id: account.id,
        mp4_ownership_reason: 'Account linked, pending verification',
      })
      .in('id', matchedSubmissionIds);
  }
}

export async function finalizeOwnershipForSocialAccount(accountId: string) {
  await associateAccountWithPendingAssets(accountId);

  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('id, user_id, platform, username, verification_status')
    .eq('id', accountId)
    .maybeSingle();

  if (!account || account.verification_status !== 'VERIFIED') {
    return;
  }
  const platform = account.platform as Platform;

  const { data: assets } = await supabaseAdmin
    .from('raw_video_assets')
    .select('id, video_url, video_fingerprint, contest_submission_id')
    .eq('owner_social_account_id', accountId)
    .in('ownership_status', ['pending', 'contested']);

  if (!assets || assets.length === 0) return;

  for (const asset of assets) {
    await supabaseAdmin
      .from('raw_video_assets')
      .update({
        ownership_status: 'verified',
        ownership_verified_at: new Date().toISOString(),
        ownership_reason: 'Ownership verified via connected account',
      })
      .eq('id', asset.id);

    await upsertOwnershipClaim({
      standardizedUrl: asset.video_url,
      platform,
      assetId: asset.id,
      userId: account.user_id,
      socialAccountId: account.id,
      status: 'claimed',
    });

    if (asset.contest_submission_id) {
      await supabaseAdmin
        .from('contest_submissions')
        .update({
          mp4_ownership_status: 'verified',
          mp4_owner_social_account_id: account.id,
          mp4_ownership_reason: `Ownership verified for @${account.username || 'your account'}`,
          verification_status: 'verified',
          ownership_resolved_at: new Date().toISOString(),
        })
        .eq('id', asset.contest_submission_id);
    }

    const { data: competingAssets } = await supabaseAdmin
      .from('raw_video_assets')
      .select('id, contest_submission_id')
      .eq('video_fingerprint', asset.video_fingerprint)
      .neq('id', asset.id);

    if (competingAssets && competingAssets.length > 0) {
      const losingIds = competingAssets.map((item) => item.id);
      await supabaseAdmin
        .from('raw_video_assets')
        .update({
          ownership_status: 'failed',
          ownership_reason: `Ownership claimed by @${account.username || 'verified creator'}`,
        })
        .in('id', losingIds);

      const losingSubmissionIds = competingAssets
        .map((item) => item.contest_submission_id)
        .filter((id): id is number => Boolean(id));

      if (losingSubmissionIds.length > 0) {
        await supabaseAdmin
          .from('contest_submissions')
          .update({
            mp4_ownership_status: 'failed',
            mp4_ownership_reason: `Ownership claimed by @${account.username || 'another creator'}.`,
            ownership_resolved_at: new Date().toISOString(),
            is_disqualified: true,
          })
          .in('id', losingSubmissionIds);
      }
    }
  }
}


