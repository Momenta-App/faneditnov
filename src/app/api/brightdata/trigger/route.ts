import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';
import { checkVideoSubmissionQuota, recordVideoSubmission } from '@/lib/quota-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { detectPlatform, isValidUrl, standardizeUrl } from '@/lib/url-utils';
import { resolveAccountOwnership } from '@/lib/video-ownership';
import { storeRawVideoAsset, upsertOwnershipClaim } from '@/lib/raw-video-assets';

type Platform = 'tiktok' | 'instagram' | 'youtube';

export const runtime = 'nodejs';

// Server-side environment variables
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;
const BRIGHT_DATA_CUSTOMER_ID = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID;
const BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID = process.env.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID;
const BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID = process.env.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID;
const BRIGHT_DATA_MOCK_MODE = process.env.BRIGHT_DATA_MOCK_MODE;

type Mp4Attachment = {
  file: File;
  platform: Platform;
  standardizedUrl: string;
};

type ProcessSubmissionOptions = {
  user: any;
  urls: string[];
  skipValidation: boolean;
  mp4Attachment?: Mp4Attachment | null;
};

/**
 * Gets the appropriate scraper ID based on the platform
 */
function getScraperId(platform: string): string | null {
  switch (platform) {
    case 'tiktok':
      return BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID || null;
    case 'instagram':
      return BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID || null;
    case 'youtube':
      return BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID || null;
    default:
      return null;
  }
}

function buildErrorResponse(payload: any, status = 400) {
  return NextResponse.json(payload, { status });
}

async function handleMultipartSubmission(request: NextRequest, user: any): Promise<NextResponse> {
  const formData = await request.formData();
  const rawUrl = formData.get('video_url');

  if (!rawUrl || typeof rawUrl !== 'string') {
    return buildErrorResponse({ error: 'Video URL is required', code: 'VALIDATION_ERROR' });
  }

  let standardizedUrl: string;
  try {
    standardizedUrl = standardizeUrl(rawUrl.trim());
  } catch (error) {
    return buildErrorResponse({
      error: 'Invalid URL',
      code: 'VALIDATION_ERROR',
      details: error instanceof Error ? error.message : 'Unsupported URL format',
    });
  }

  if (!isValidUrl(standardizedUrl)) {
    return buildErrorResponse({
      error: 'Invalid URL',
      code: 'VALIDATION_ERROR',
      details: 'URL must be TikTok, Instagram post/reel, or YouTube Shorts',
    });
  }

  const platform = detectPlatform(standardizedUrl) as Platform | 'unknown';
  if (platform === 'unknown') {
    return buildErrorResponse({
      error: 'Unsupported platform',
      code: 'VALIDATION_ERROR',
      details: 'Only TikTok, Instagram posts/reels, and YouTube Shorts URLs are supported.',
    });
  }

  const skipValidation = formData.get('skip_validation') === 'true';
  const mp4File = formData.get('mp4_file');
  const mp4Attachment =
    mp4File instanceof File && mp4File.size > 0
      ? {
          file: mp4File,
          platform,
          standardizedUrl,
        }
      : null;

  return processSubmission({
    user,
    urls: [standardizedUrl],
    skipValidation,
    mp4Attachment,
  });
}

async function processSubmission(options: ProcessSubmissionOptions): Promise<NextResponse> {
  const { user, urls, skipValidation, mp4Attachment } = options;
  let rawAssetRecord: { id: string; path: string } | null = null;
  let placeholderSnapshotId: string | null = null;
  let verifiedMp4AccountId: string | null = null;

  try {
    const quotaStatus = await checkVideoSubmissionQuota(user.id, user.role);

    if (!quotaStatus.allowed) {
      return buildErrorResponse(
        {
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: {
            limit: quotaStatus.limit,
            current: quotaStatus.current,
            remaining: quotaStatus.remaining,
            resetAt: quotaStatus.resetAt.toISOString(),
          },
        },
        429
      );
    }

    const platforms = urls.map((url) => detectPlatform(url));
    const uniquePlatforms = [...new Set(platforms)];

    if (uniquePlatforms.length > 1) {
      return buildErrorResponse({
        error: 'Mixed platforms not allowed',
        code: 'VALIDATION_ERROR',
        details: 'All URLs in a batch must be from the same platform (TikTok, Instagram, or YouTube)',
      });
    }

    const platform = uniquePlatforms[0] as Platform | 'unknown';
    if (platform === 'unknown') {
      return buildErrorResponse({
        error: 'Unsupported platform',
        code: 'VALIDATION_ERROR',
        details: 'Only TikTok, Instagram posts/reels, and YouTube Shorts URLs are supported.',
      });
    }

    let mp4Account = null;
    if (mp4Attachment) {
      if (urls.length !== 1) {
        return buildErrorResponse({
          error: 'MP4 attachments are only supported for single URL submissions',
          code: 'VALIDATION_ERROR',
        });
      }
      if (mp4Attachment.platform !== platform) {
        return buildErrorResponse({
          error: 'MP4 platform mismatch',
          code: 'VALIDATION_ERROR',
          details: 'Attached MP4 must match the URL platform',
        });
      }

      const ownership = await resolveAccountOwnership({
        userId: user.id,
        platform,
        standardizedUrl: mp4Attachment.standardizedUrl,
        requireVerified: true,
      });

      if (ownership.status !== 'verified' || !ownership.account) {
        return buildErrorResponse(
          {
            error: 'Unable to verify account ownership for this MP4 upload.',
            code: 'OWNERSHIP_REQUIRED',
            details: 'Connect the correct social account in Settings or remove the MP4 attachment.',
          },
          400
        );
      }

      mp4Account = ownership.account;
      verifiedMp4AccountId = ownership.account.id;
    }

    const scraperId = getScraperId(platform);
    if (!scraperId) {
      const scraperEnvVar =
        platform === 'tiktok'
          ? 'BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID'
          : platform === 'instagram'
          ? 'BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID'
          : 'BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID';

      return buildErrorResponse(
        {
          error: `${platform} scraper not configured`,
          code: 'CONFIGURATION_ERROR',
          details: `${scraperEnvVar} environment variable is required`,
        },
        500
      );
    }

    placeholderSnapshotId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return buildErrorResponse({ error: 'Database connection not available' }, 500);
    }

    const { error: metadataError } = await supabaseAdmin.from('submission_metadata').insert({
      snapshot_id: placeholderSnapshotId,
      video_urls: urls,
      skip_validation: skipValidation,
      submitted_by: user.id,
    });

    if (metadataError) {
      console.error('Failed to store submission metadata:', metadataError);
    }

    if (mp4Attachment && mp4Account && placeholderSnapshotId) {
      const asset = await storeRawVideoAsset({
        userId: user.id,
        platform,
        standardizedUrl: mp4Attachment.standardizedUrl,
        mp4File: mp4Attachment.file,
        submissionType: 'general',
        submissionMetadataId: placeholderSnapshotId,
        ownershipStatus: 'verified',
        ownerSocialAccountId: mp4Account.id,
      });

      await upsertOwnershipClaim({
        standardizedUrl: mp4Attachment.standardizedUrl,
        platform,
        assetId: asset.assetId,
        userId: user.id,
        socialAccountId: mp4Account.id,
        status: 'claimed',
      });

      rawAssetRecord = { id: asset.assetId, path: asset.storagePath };
    }

    if (BRIGHT_DATA_MOCK_MODE === 'true') {
      const mockSnapshotId = `mock_snapshot_${Date.now()}`;
      await supabaseAdmin
        .from('submission_metadata')
        .update({ snapshot_id: mockSnapshotId })
        .eq('snapshot_id', placeholderSnapshotId);

      if (rawAssetRecord) {
        await supabaseAdmin
          .from('raw_video_assets')
          .update({ submission_metadata_id: mockSnapshotId })
          .eq('id', rawAssetRecord.id);
      }

      await recordVideoSubmission(user.id);

      return NextResponse.json({
        snapshot_id: mockSnapshotId,
        status: 'queued',
        mock: true,
        urls,
        platform,
      });
    }

    const brightDataPayload = urls.map((url) => ({ url }));
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      if (process.env.VERCEL_URL) {
        appUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        appUrl = 'https://www.sportsclips.io';
      }
    }

    if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    if (appUrl === 'https://sportsclips.io' || appUrl === 'https://sportsclips.io/') {
      appUrl = 'https://www.sportsclips.io';
    }

    if (
      appUrl === 'https://fanedit.com' ||
      appUrl === 'https://fanedit.com/' ||
      appUrl === 'https://www.fanedit.com' ||
      appUrl === 'https://www.fanedit.com/'
    ) {
      appUrl = 'https://www.sportsclips.io';
    }

    appUrl = appUrl.replace(/\/+$/, '');

    const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/webhook`);
    const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${scraperId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brightDataPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BrightData API error:', response.status, errorText);
      throw new Error(`BrightData API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const actualSnapshotId = result.snapshot_id || result.snapshotId;

    if (actualSnapshotId) {
      const { error: updateError } = await supabaseAdmin
        .from('submission_metadata')
        .update({ snapshot_id: actualSnapshotId })
        .eq('snapshot_id', placeholderSnapshotId);

      if (updateError) {
        console.error('Failed to update metadata snapshot_id:', updateError);
      }

      if (rawAssetRecord) {
        await supabaseAdmin
          .from('raw_video_assets')
          .update({ submission_metadata_id: actualSnapshotId })
          .eq('id', rawAssetRecord.id);
      }
    } else {
      console.warn('No snapshot_id returned from BrightData response');
    }

    await recordVideoSubmission(user.id);

    return NextResponse.json(result);
  } catch (error) {
    if (rawAssetRecord) {
      try {
        await supabaseAdmin.storage.from('contest-videos').remove([rawAssetRecord.path]);
      } catch (storageError) {
        console.warn('Failed to remove uploaded MP4 after error:', storageError);
      }
      await supabaseAdmin.from('raw_video_assets').delete().eq('id', rawAssetRecord.id);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return await handleMultipartSubmission(request, user);
    }

    const body = await request.json();
    const { urls, skip_validation = false } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return buildErrorResponse(
        { error: 'URLs array is required and cannot be empty', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const standardizedUrls: string[] = [];
    const validationErrors: string[] = [];

    for (const url of urls) {
      try {
        const standardized = standardizeUrl(url.trim());
        const isValid = isValidUrl(standardized);

        if (isValid) {
          standardizedUrls.push(standardized);
        } else {
          validationErrors.push(`${url} is not a valid TikTok, Instagram, or YouTube Shorts URL`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid URL format';
        validationErrors.push(`${url}: ${errorMessage}`);
      }
    }

    if (validationErrors.length > 0) {
      return buildErrorResponse({
        error: 'Invalid URLs detected',
        code: 'VALIDATION_ERROR',
        details:
          'All URLs must be valid TikTok, Instagram posts/reels, or YouTube Shorts URLs. Regular YouTube videos are not accepted.',
        errors: validationErrors.slice(0, 5),
      });
    }

    if (standardizedUrls.length === 0) {
      return buildErrorResponse({
        error: 'No valid URLs',
        code: 'VALIDATION_ERROR',
        details: 'All provided URLs were invalid. Only TikTok, Instagram posts/reels, and YouTube Shorts are accepted.',
      });
    }

    return await processSubmission({
      user,
      urls: standardizedUrls,
      skipValidation: skip_validation,
      mp4Attachment: null,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error);
    }

    console.error('Trigger API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'BrightData Trigger API',
    mockMode: BRIGHT_DATA_MOCK_MODE,
    supportedPlatforms: ['tiktok', 'instagram', 'youtube'],
    endpoints: {
      'POST /api/brightdata/trigger': 'Trigger BrightData dataset with TikTok, Instagram posts/reels, or YouTube Shorts URLs (regular YouTube videos not accepted)',
    },
    configuration: {
      tiktok: !!BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID,
      instagram: !!BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID,
      youtube: !!BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID,
    },
  });
}

