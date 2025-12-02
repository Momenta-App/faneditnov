/**
 * BrightData webhook handler for contest submissions
 * Receives video stats data and updates contest submissions
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeBrightDataRecord } from '@/lib/brightdata-normalizer';
import { attachNormalizedMetrics } from '@/lib/brightdata-normalizer';
import { downloadAndStoreImage, isSupabaseUrl, storeImageWithDeduplication } from '@/lib/image-storage';
import { resolveOwnershipConflicts } from '@/lib/contest-ownership';
import type { Platform } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Server-side environment variables
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on 429 or 5xx errors
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`[Contest Webhook] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Contest Webhook] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Process images in payload - download and store in Supabase Storage
 * Reuses logic from main webhook handler
 */
async function processImagesInPayload(payload: any[]): Promise<any[]> {
  console.log('[Contest Webhook] Processing images in payload...', { recordCount: payload.length });
  let processedCount = 0;
  let errorCount = 0;

  // Process images for each record
  for (const record of payload) {
    try {
      // Log available fields for debugging
      const availableFields = Object.keys(record).slice(0, 20); // First 20 fields
      console.log('[Contest Webhook] Record fields:', availableFields);

      // Process video cover - check multiple possible fields
      const coverUrl = record.preview_image 
        || record.cover_url 
        || record.thumbnail 
        || record.cover 
        || record.coverMedium
        || record.coverLarge
        || record.thumbnail_url
        || record.thumb_url
        || record.image_url
        || record.media?.cover
        || record.video?.cover;
      console.log('[Contest Webhook] Video cover URL check:', {
        preview_image: record.preview_image ? 'exists' : 'missing',
        cover_url: record.cover_url ? 'exists' : 'missing',
        thumbnail: record.thumbnail ? 'exists' : 'missing',
        cover: record.cover ? 'exists' : 'missing',
        foundUrl: coverUrl ? coverUrl.substring(0, 100) : 'none',
        isSupabaseUrl: coverUrl ? isSupabaseUrl(coverUrl) : false
      });

      if (coverUrl && !isSupabaseUrl(coverUrl)) {
        // Try multiple possible video ID fields
        const videoId = record.post_id 
          || record.id 
          || record.video_id
          || record.aweme_id
          || record.item_id
          || record.short_id
          || record.media_id;
        console.log('[Contest Webhook] Video ID extraction:', {
          post_id: record.post_id,
          id: record.id,
          video_id: record.video_id,
          aweme_id: record.aweme_id,
          item_id: record.item_id,
          extractedVideoId: videoId
        });

        if (videoId) {
          console.log(`[Contest Webhook] Attempting to download and store video cover: ${coverUrl.substring(0, 100)}...`);
          const result = await downloadAndStoreImage(coverUrl, 'video-cover', videoId);
          if (result.success && result.supabaseUrl) {
            // Always update ALL possible cover field paths that the ingestion function checks
            record.preview_image = result.supabaseUrl;
            record.cover_url = result.supabaseUrl;
            record.thumbnail = result.supabaseUrl;
            processedCount++;
            console.log(`[Contest Webhook] ✓ Migrated video cover for ${videoId} to ${result.supabaseUrl}`);
          } else {
            errorCount++;
            console.warn(`[Contest Webhook] ✗ Failed to migrate video cover for ${videoId}:`, result.error);
          }
        } else {
          console.warn('[Contest Webhook] ⚠ No videoId found for cover image:', {
            post_id: record.post_id,
            id: record.id,
            video_id: record.video_id
          });
        }
      } else if (coverUrl) {
        console.log('[Contest Webhook] Cover URL already in Supabase, skipping:', coverUrl.substring(0, 100));
      } else {
        console.warn('[Contest Webhook] ⚠ No cover URL found in record');
      }

      // Process creator avatar - check multiple possible fields
      const avatarUrl = record.profile_avatar 
        || record.profile?.avatar 
        || record.author?.avatarLarger 
        || record.author?.avatar?.url_list?.[0] 
        || record.author?.avatar_url 
        || record.author?.profile_pic_url 
        || record.profile?.profile_pic_url 
        || record.profile_pic_url
        || record.avatar
        || record.avatar_url
        || record.profile_picture
        || record.profile_picture_url
        || record.author?.avatarMedium
        || record.author?.avatarThumb
        || record.profile?.avatarMedium
        || record.profile?.avatarThumb;
      console.log('[Contest Webhook] Creator avatar URL check:', {
        profile_avatar: record.profile_avatar ? 'exists' : 'missing',
        profile_avatar_nested: record.profile?.avatar ? 'exists' : 'missing',
        author_avatarLarger: record.author?.avatarLarger ? 'exists' : 'missing',
        author_avatar_url: record.author?.avatar_url ? 'exists' : 'missing',
        avatar: record.avatar ? 'exists' : 'missing',
        foundUrl: avatarUrl ? avatarUrl.substring(0, 100) : 'none',
        isSupabaseUrl: avatarUrl ? isSupabaseUrl(avatarUrl) : false
      });

      if (avatarUrl && !isSupabaseUrl(avatarUrl)) {
        // Try multiple possible creator ID fields
        const creatorId = record.profile_id 
          || record.author?.id 
          || record.profile?.id
          || record.creator_id
          || record.user_id
          || record.uid
          || record.user?.id
          || record.author?.uid;
        console.log('[Contest Webhook] Creator ID extraction:', {
          profile_id: record.profile_id,
          author_id: record.author?.id,
          profile_id_nested: record.profile?.id,
          creator_id: record.creator_id,
          user_id: record.user_id,
          extractedCreatorId: creatorId
        });

        if (creatorId) {
          console.log(`[Contest Webhook] Attempting to download and store creator avatar: ${avatarUrl.substring(0, 100)}...`);
          const result = await downloadAndStoreImage(avatarUrl, 'creator-avatar', creatorId);
          if (result.success && result.supabaseUrl) {
            // Update all possible avatar field paths that the ingestion function checks
            if (record.profile_avatar) record.profile_avatar = result.supabaseUrl;
            if (record.profile?.avatar) record.profile.avatar = result.supabaseUrl;
            if (record.author?.avatarLarger) record.author.avatarLarger = result.supabaseUrl;
            if (record.author?.avatar_url) record.author.avatar_url = result.supabaseUrl;
            if (record.author?.profile_pic_url) record.author.profile_pic_url = result.supabaseUrl;
            if (record.profile?.profile_pic_url) record.profile.profile_pic_url = result.supabaseUrl;
            if (record.profile_pic_url) record.profile_pic_url = result.supabaseUrl;
            // Update nested avatar.url_list if it exists
            if (record.author?.avatar?.url_list && Array.isArray(record.author.avatar.url_list) && record.author.avatar.url_list.length > 0) {
              record.author.avatar.url_list[0] = result.supabaseUrl;
            }
            if (record.profile?.avatar?.url_list && Array.isArray(record.profile.avatar.url_list) && record.profile.avatar.url_list.length > 0) {
              record.profile.avatar.url_list[0] = result.supabaseUrl;
            }
            processedCount++;
            console.log(`[Contest Webhook] ✓ Migrated creator avatar for ${creatorId} to ${result.supabaseUrl}`);
          } else {
            errorCount++;
            console.warn(`[Contest Webhook] ✗ Failed to migrate creator avatar for ${creatorId}:`, result.error);
          }
        } else {
          console.warn('[Contest Webhook] ⚠ No creatorId found for avatar image:', {
            profile_id: record.profile_id,
            author_id: record.author?.id,
            profile_id_nested: record.profile?.id
          });
        }
      } else if (avatarUrl) {
        console.log('[Contest Webhook] Avatar URL already in Supabase, skipping:', avatarUrl.substring(0, 100));
      } else {
        console.warn('[Contest Webhook] ⚠ No avatar URL found in record');
      }

      // Process sound cover (if exists)
      const soundCoverUrl = record.music?.cover || record.music?.coverLarge;
      if (soundCoverUrl && !isSupabaseUrl(soundCoverUrl)) {
        const soundId = record.music?.id || record.music?.music_id;
        if (soundId) {
          const result = await downloadAndStoreImage(soundCoverUrl, 'sound-cover', soundId);
          if (result.success && result.supabaseUrl) {
            if (record.music?.cover) record.music.cover = result.supabaseUrl;
            if (record.music?.coverLarge) record.music.coverLarge = result.supabaseUrl;
            processedCount++;
            console.log(`[Contest Webhook] ✓ Migrated sound cover for ${soundId}`);
          } else {
            errorCount++;
            console.warn(`[Contest Webhook] ✗ Failed to migrate sound cover for ${soundId}:`, result.error);
          }
        }
      }
    } catch (error) {
      errorCount++;
      console.error('[Contest Webhook] Error processing images for record:', error);
      // Continue with next record even if this one fails
    }
  }

  console.log(`[Contest Webhook] Image processing complete: ${processedCount} images migrated, ${errorCount} errors`);
  return payload;
}

/**
 * POST /api/brightdata/contest-webhook
 * Handle BrightData webhook for contest submission stats
 */
export async function POST(request: NextRequest) {
  console.log('[Contest Webhook] ========== WEBHOOK CALLED ==========');
  console.log('[Contest Webhook] Request method:', request.method);
  console.log('[Contest Webhook] Request URL:', request.url);
  console.log('[Contest Webhook] Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const rawBody = await request.text();
    console.log('[Contest Webhook] Raw body length:', rawBody.length);
    console.log('[Contest Webhook] Raw body preview:', rawBody.substring(0, 500));
    
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[Contest Webhook] JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Log payload structure for debugging
    console.log('[Contest Webhook] Received payload:', {
      isArray: Array.isArray(payload),
      payloadKeys: Array.isArray(payload) ? `Array with ${payload.length} items` : Object.keys(payload).slice(0, 10),
      firstRecordKeys: Array.isArray(payload) && payload[0] ? Object.keys(payload[0]).slice(0, 20) : Object.keys(payload).slice(0, 20)
    });

    // BrightData can send webhooks in two formats:
    // 1. Status notification with snapshot_id pointing to snapshot
    // 2. Direct data payload (with uncompressed_webhook=true)
    
    // Check if this is data payload (array of records)
    if (Array.isArray(payload) && payload.length > 0) {
      console.log('[Contest Webhook] Received data payload directly, processing...');
      // Process the data payload directly - continue with existing logic below
    } else {
      // This is a notification webhook - need to download data from BrightData API
      console.log('[Contest Webhook] Received notification webhook, extracting snapshot_id...');
      
      let snapshot_id = payload.snapshot_id || payload.snapshotId || payload.response_id || payload.request_id;
      let dataset_id = payload.dataset_id || payload.datasetId || '';
      
      if (!snapshot_id) {
        console.error('[Contest Webhook] Unable to extract snapshot_id from notification:', payload);
        return NextResponse.json(
          { error: 'snapshot_id is required', received_payload: payload },
          { status: 400 }
        );
      }
      
      // Check if this is just a notification webhook (no data payload)
      const isNotificationOnly = payload.status && !Array.isArray(payload) && !payload.data && Object.keys(payload).length <= 3;
      
      if (isNotificationOnly) {
        console.log('[Contest Webhook] Notification-only webhook received, acknowledging and waiting for data webhook...', { 
          snapshot_id, 
          status: payload.status 
        });
        return NextResponse.json({
          message: 'Notification received, waiting for data webhook',
          snapshot_id: snapshot_id,
          status: payload.status
        });
      }
      
      // Download snapshot data from BrightData
      console.log('[Contest Webhook] Downloading snapshot data from BrightData...', { snapshot_id, status: payload.status });
      
      if (!BRIGHT_DATA_API_KEY) {
        console.error('[Contest Webhook] BRIGHT_DATA_API_KEY not configured');
        return NextResponse.json({ error: 'BrightData API key not configured' }, { status: 500 });
      }
      
      // Wait for snapshot to be ready
      let snapshotReady = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!snapshotReady && attempts < maxAttempts) {
        try {
          const snapshotResponse = await fetchWithRetry(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`,
            {
              headers: {
                'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
              },
            }
          );

          if (!snapshotResponse.ok) {
            console.error(`[Contest Webhook] Snapshot API returned ${snapshotResponse.status}`);
            if (attempts < maxAttempts) {
              attempts++;
              await sleep(2000);
              continue;
            }
            break;
          }

          const snapshotData = await snapshotResponse.json();
          console.log('[Contest Webhook] Snapshot status:', snapshotData.status);

          if (snapshotData.status === 'ready') {
            snapshotReady = true;
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              console.log(`[Contest Webhook] Snapshot not ready, waiting 2s (attempt ${attempts}/${maxAttempts})`);
              await sleep(2000);
            }
          }
        } catch (error) {
          console.error('[Contest Webhook] Error checking snapshot status:', error);
          attempts++;
          if (attempts < maxAttempts) {
            await sleep(2000);
          }
        }
      }

      if (!snapshotReady) {
        console.warn('[Contest Webhook] Snapshot not ready after maximum attempts, attempting to proceed anyway...');
      }
      
      // Download snapshot data from BrightData
      console.log('[Contest Webhook] Downloading snapshot data from BrightData API...');
      const dataResponse = await fetchWithRetry(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}/data`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
          },
        },
        2
      );

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error('[Contest Webhook] Data download failed:', dataResponse.status, errorText);
        return NextResponse.json(
          { 
            error: 'Failed to download snapshot data',
            details: `API returned ${dataResponse.status}: ${errorText}`
          },
          { status: 500 }
        );
      }

      const downloadedPayload = await dataResponse.json();
      console.log('[Contest Webhook] Data downloaded, processing...', { recordCount: Array.isArray(downloadedPayload) ? downloadedPayload.length : 'unknown' });
      
      // Replace payload with downloaded data and continue processing
      payload = downloadedPayload;
    }

    // BrightData sends data in various formats
    const data = Array.isArray(payload) ? payload : [payload];
    if (data.length === 0) {
      return NextResponse.json({ error: 'No data received' }, { status: 400 });
    }

    const record = data[0];
    
    // Log first record structure for debugging image fields
    console.log('[Contest Webhook] First record structure:', {
      hasPreviewImage: !!record.preview_image,
      hasCoverUrl: !!record.cover_url,
      hasThumbnail: !!record.thumbnail,
      hasProfile: !!record.profile,
      hasAuthor: !!record.author,
      post_id: record.post_id,
      id: record.id,
      video_id: record.video_id,
      profile_id: record.profile_id
    });

    // Extract video URL and snapshot ID to find submission
    const videoUrl = record.url || record.video_url || record.post_url;
    const snapshotId = record.snapshot_id || record.id || record.collection_id;
    
    if (!videoUrl) {
      console.error('[Contest Webhook] No video URL in payload');
      return NextResponse.json({ error: 'No video URL' }, { status: 400 });
    }

    console.log('[Contest Webhook] Received webhook:', { videoUrl, snapshotId });

    // Try to find submission by snapshot_id first (most reliable)
    let submission: any = null;
    let submissionError: any = null;

    if (snapshotId) {
      const { data, error } = await supabaseAdmin
        .from('contest_submissions')
        .select(`
          *,
          contests:contest_id (
            id,
            required_hashtags,
            required_description_template
          )
        `)
        .eq('snapshot_id', snapshotId)
        .maybeSingle();

      if (!error && data) {
        submission = data;
        console.log('[Contest Webhook] Found submission by snapshot_id:', snapshotId);
      } else {
        console.warn('[Contest Webhook] No submission found by snapshot_id:', snapshotId);
      }
    }

    // Fallback: Find submission by snapshot_id in submission_metadata or by processing status
    // Note: original_video_url no longer exists, so we use snapshot_id lookup
    if (!submission) {
      // Try to find via submission_metadata first
      if (snapshotId) {
        const { data: metadata } = await supabaseAdmin
          .from('submission_metadata')
          .select('contest_submission_id')
          .eq('snapshot_id', snapshotId)
          .maybeSingle();
        
        if (metadata?.contest_submission_id) {
          const { data, error } = await supabaseAdmin
            .from('contest_submissions')
            .select(`
              *,
              contests:contest_id (
                id,
                required_hashtags,
                required_description_template
              )
            `)
            .eq('id', metadata.contest_submission_id)
            .maybeSingle();
          
          if (!error && data) {
            submission = data;
            console.log('[Contest Webhook] Found submission via submission_metadata:', snapshotId);
          }
        }
      }
      
      // Last resort: find by processing status (less reliable)
      if (!submission) {
        const { data, error } = await supabaseAdmin
          .from('contest_submissions')
          .select(`
            *,
            contests:contest_id (
              id,
              required_hashtags,
              required_description_template
            )
          `)
          .eq('processing_status', 'fetching_stats')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        submission = data;
        submissionError = error;
        
        if (submission) {
          console.log('[Contest Webhook] Found submission by processing_status (fallback)');
        }
      }

      if (submission) {
        console.log('[Contest Webhook] Found submission:', videoUrl);
        // Update with snapshot_id if we have it
        if (snapshotId) {
          await supabaseAdmin
            .from('contest_submissions')
            .update({ snapshot_id: snapshotId })
            .eq('id', submission.id);
        }
      }
    }

    if (submissionError || !submission) {
      console.error('[Contest Webhook] Submission not found:', {
        videoUrl,
        snapshotId,
        error: submissionError?.message,
      });
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const contest = submission.contests as any;

    console.log('[Contest Webhook] Starting stats extraction and save process...', {
      submission_id: submission.id,
      platform: submission.platform,
      video_url: submission.original_video_url
    });

    // Step 1: Process images (download and store in Supabase Storage)
    // This must happen before ingestion so images are available
    console.log('[Contest Webhook] Processing images before ingestion...');
    const processedData = await processImagesInPayload(data);
    
    // Apply normalization (same as normal webhook) to get normalized_metrics
    const normalizedData = processedData.map(rec => attachNormalizedMetrics(rec));
    const processedRecord = normalizedData[0] || record;
    
    console.log('[Contest Webhook] Processed record available:', {
      submission_id: submission.id,
      has_processed_record: !!processedRecord,
      processed_record_keys: processedRecord ? Object.keys(processedRecord).slice(0, 30) : [],
      has_normalized_metrics: !!(processedRecord?.normalized_metrics)
    });

    // Step 1.5: Store images with deduplication for contest_submissions
    // Extract cover image and creator avatar URLs from BrightData payload
    const coverUrl = processedRecord.preview_image 
      || processedRecord.cover_url 
      || processedRecord.thumbnail 
      || processedRecord.cover 
      || processedRecord.coverMedium
      || processedRecord.coverLarge
      || processedRecord.thumbnail_url
      || processedRecord.thumb_url
      || processedRecord.image_url
      || processedRecord.media?.cover
      || processedRecord.video?.cover;

    const avatarUrl = processedRecord.profile_avatar 
      || processedRecord.profile?.avatar 
      || processedRecord.author?.avatarLarger 
      || processedRecord.author?.avatar?.url_list?.[0] 
      || processedRecord.author?.avatar_url 
      || processedRecord.author?.profile_pic_url 
      || processedRecord.profile?.profile_pic_url 
      || processedRecord.profile_pic_url
      || processedRecord.avatar
      || processedRecord.avatar_url
      || processedRecord.profile_picture
      || processedRecord.profile_picture_url
      || processedRecord.author?.avatarMedium
      || processedRecord.author?.avatarThumb
      || processedRecord.profile?.avatarMedium
      || processedRecord.profile?.avatarThumb;

    // Extract video_id and creator_id
    const videoId = processedRecord.post_id 
      || processedRecord.id 
      || processedRecord.video_id
      || processedRecord.aweme_id
      || processedRecord.item_id
      || processedRecord.short_id
      || processedRecord.media_id
      || submission.video_id;

    const creatorId = processedRecord.profile_id 
      || processedRecord.author?.id 
      || processedRecord.profile?.id
      || processedRecord.creator_id
      || processedRecord.user_id
      || processedRecord.uid
      || processedRecord.user?.id
      || processedRecord.author?.uid;

    // Extract creator username from scraped data (platform-specific)
    let creatorUsername: string | null = null;
    if (platform === 'tiktok') {
      creatorUsername = processedRecord.author?.unique_id 
        || processedRecord.profile?.unique_id
        || processedRecord.author_username
        || processedRecord.profile_username
        || null;
    } else if (platform === 'youtube') {
      creatorUsername = processedRecord.youtuber 
        || processedRecord.channel_name
        || null;
      // Remove @ prefix if present
      if (creatorUsername) {
        creatorUsername = creatorUsername.replace(/^@/, '');
      }
    } else if (platform === 'instagram') {
      creatorUsername = processedRecord.user_posted
        || processedRecord.author?.username
        || processedRecord.profile?.username
        || null;
    }

    // Verify ownership after scraping: match creator username with connected account
    if (creatorUsername && submission.mp4_ownership_status === 'pending' && submission.user_id) {
      console.log('[Contest Webhook] Verifying ownership after scraping:', {
        submissionId: submission.id,
        creatorUsername,
        platform,
        userId: submission.user_id,
      });

      // Find user's verified social accounts for this platform
      const { data: userAccounts } = await supabaseAdmin
        .from('social_accounts')
        .select('id, username, user_id, verification_status')
        .eq('user_id', submission.user_id)
        .eq('platform', platform)
        .eq('verification_status', 'VERIFIED');

      if (userAccounts && userAccounts.length > 0) {
        // Normalize usernames for comparison
        const normalizedCreatorUsername = creatorUsername.toLowerCase().replace('@', '').trim();
        
        for (const account of userAccounts) {
          const accountUsername = account.username?.toLowerCase().replace('@', '').trim();
          
          if (accountUsername && accountUsername === normalizedCreatorUsername) {
            // Match found! Verify ownership
            console.log('[Contest Webhook] ✓ Ownership verified:', {
              submissionId: submission.id,
              creatorUsername,
              accountUsername: account.username,
              accountId: account.id,
            });

            // Update submission ownership status
            await supabaseAdmin
              .from('contest_submissions')
              .update({
                mp4_ownership_status: 'verified',
                mp4_owner_social_account_id: account.id,
                mp4_ownership_reason: `Ownership verified: video creator @${creatorUsername} matches connected account @${account.username}`,
                verification_status: 'verified',
                ownership_resolved_at: new Date().toISOString(),
              })
              .eq('id', submission.id);

            // Update raw_video_assets ownership status
            if (submission.raw_video_asset_id) {
              await supabaseAdmin
                .from('raw_video_assets')
                .update({
                  ownership_status: 'verified',
                  owner_social_account_id: account.id,
                  ownership_verified_at: new Date().toISOString(),
                  ownership_reason: `Ownership verified: video creator @${creatorUsername} matches connected account @${account.username}`,
                })
                .eq('id', submission.raw_video_asset_id);
            }

            // Resolve any ownership conflicts for this video
            try {
              await resolveOwnershipConflicts(
                submission.original_video_url,
                account.id,
                submission.user_id
              );
            } catch (err) {
              console.error('[Contest Webhook] Error resolving ownership conflicts:', err);
            }

            break; // Found match, no need to check other accounts
          }
        }
      } else {
        console.log('[Contest Webhook] No verified accounts found for user:', {
          userId: submission.user_id,
          platform,
        });
      }
    }

    let coverImageUrl: string | null = null;
    let creatorAvatarUrl: string | null = null;

    // Store cover image with deduplication
    // Store images even if videoId is missing - use submission ID as fallback identifier
    if (coverUrl) {
      if (isSupabaseUrl(coverUrl)) {
        // Already a Supabase URL, use it directly
        coverImageUrl = coverUrl;
        console.log('[Contest Webhook] Cover image already in Supabase, using existing URL');
      } else {
        // Use videoId if available, otherwise use submission ID as fallback
        const identifier = videoId || `submission-${submission.id}`;
        console.log('[Contest Webhook] Storing cover image with deduplication for video:', identifier);
        
        // Check if this video already exists in contest_submissions or videos_hot
        let existingCoverUrl: string | null = null;
        
        // Check current submission first (might already have cover_image_url)
        if (submission.cover_image_url && isSupabaseUrl(submission.cover_image_url)) {
          existingCoverUrl = submission.cover_image_url;
        }
        
        // Check contest_submissions for same video_id and platform
        if (!existingCoverUrl && videoId && submission.platform) {
          const { data: existingSubmission } = await supabaseAdmin
            .from('contest_submissions')
            .select('cover_image_url, video_id')
            .eq('video_id', videoId)
            .eq('platform', submission.platform)
            .neq('id', submission.id)
            .not('cover_image_url', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (existingSubmission?.cover_image_url && isSupabaseUrl(existingSubmission.cover_image_url)) {
            existingCoverUrl = existingSubmission.cover_image_url;
          }
        }
        
        // Check videos_hot for same video_url
        if (!existingCoverUrl && videoUrl) {
          const { data: existingVideo } = await supabaseAdmin
            .from('videos_hot')
            .select('cover_url, video_url')
            .eq('video_url', videoUrl)
            .not('cover_url', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (existingVideo?.cover_url && isSupabaseUrl(existingVideo.cover_url)) {
            existingCoverUrl = existingVideo.cover_url;
          }
        }
        
        // Use deduplication logic to check if we should reuse or replace
        const result = await storeImageWithDeduplication(coverUrl, 'video-cover', identifier);
        if (result.success && result.supabaseUrl) {
          coverImageUrl = result.supabaseUrl;
          console.log('[Contest Webhook] ✓ Stored/reused cover image:', coverImageUrl);
        } else {
          console.warn('[Contest Webhook] ✗ Failed to store cover image:', result.error);
        }
      }
    }

    // Store creator avatar with deduplication
    // Store images even if creatorId is missing - use submission ID as fallback identifier
    if (avatarUrl) {
      if (isSupabaseUrl(avatarUrl)) {
        // Already a Supabase URL, use it directly
        creatorAvatarUrl = avatarUrl;
        console.log('[Contest Webhook] Creator avatar already in Supabase, using existing URL');
      } else {
        // Use creatorId if available, otherwise use submission ID as fallback
        const identifier = creatorId || `submission-${submission.id}`;
        console.log('[Contest Webhook] Storing creator avatar with deduplication for creator:', identifier);
        
        // Check current submission first (might already have creator_avatar_url)
        if (submission.creator_avatar_url && isSupabaseUrl(submission.creator_avatar_url)) {
          // Current submission already has avatar, but check if source URL changed
          const result = await storeImageWithDeduplication(avatarUrl, 'creator-avatar', identifier);
          if (result.success && result.supabaseUrl) {
            creatorAvatarUrl = result.supabaseUrl;
            console.log('[Contest Webhook] ✓ Stored/reused creator avatar:', creatorAvatarUrl);
          } else {
            console.warn('[Contest Webhook] ✗ Failed to store creator avatar:', result.error);
          }
        } else {
          // Use deduplication logic (it will check storage for existing avatar)
          const result = await storeImageWithDeduplication(avatarUrl, 'creator-avatar', identifier);
          if (result.success && result.supabaseUrl) {
            creatorAvatarUrl = result.supabaseUrl;
            console.log('[Contest Webhook] ✓ Stored/reused creator avatar:', creatorAvatarUrl);
          } else {
            console.warn('[Contest Webhook] ✗ Failed to store creator avatar:', result.error);
          }
        }
      }
    }

    // Update contest_submissions with image URLs before ingestion
    // Always update if we have image URLs, even if only one is set
    if (coverImageUrl || creatorAvatarUrl) {
      const updateData: any = {};
      if (coverImageUrl) updateData.cover_image_url = coverImageUrl;
      if (creatorAvatarUrl) updateData.creator_avatar_url = creatorAvatarUrl;
      
      const { error: updateError } = await supabaseAdmin
        .from('contest_submissions')
        .update(updateData)
        .eq('id', submission.id);
      
      if (updateError) {
        console.error('[Contest Webhook] Failed to update contest_submissions with image URLs:', {
          submissionId: submission.id,
          error: updateError.message,
          coverImageUrl: coverImageUrl ? 'set' : 'not set',
          creatorAvatarUrl: creatorAvatarUrl ? 'set' : 'not set',
        });
      } else {
        console.log('[Contest Webhook] ✓ Updated contest_submissions with image URLs:', {
          submissionId: submission.id,
          coverImageUrl: coverImageUrl ? coverImageUrl.substring(0, 100) + '...' : 'not set',
          creatorAvatarUrl: creatorAvatarUrl ? creatorAvatarUrl.substring(0, 100) + '...' : 'not set',
        });
      }
    } else {
      console.log('[Contest Webhook] No image URLs to update (coverUrl:', !!coverUrl, ', avatarUrl:', !!avatarUrl, ')');
    }

    // Get platform from submission metadata or infer from URL
    const platform = submission.platform || 
      (videoUrl.includes('tiktok') ? 'tiktok' : 
       videoUrl.includes('instagram') ? 'instagram' : 
       videoUrl.includes('youtube') ? 'youtube' : 'unknown');

    // Update processing status
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        processing_status: 'checking_hashtags',
      })
      .eq('id', submission.id);

    // Extract description and hashtags from BrightData (use processed record)
    const descriptionText = processedRecord.description || processedRecord.caption || processedRecord.text || '';
    
    // Extract hashtags from multiple sources
    const hashtags: string[] = [];
    
    // 1. Check if BrightData provides a separate hashtags array
    if (processedRecord.hashtags) {
      if (Array.isArray(processedRecord.hashtags)) {
        for (const item of processedRecord.hashtags) {
          if (typeof item === 'string') {
            hashtags.push(item);
          } else if (item && typeof item === 'object') {
            if (item.hashtag) {
              hashtags.push(item.hashtag);
            } else if (item.tag) {
              hashtags.push(item.tag);
            }
          }
        }
      }
    }
    
    // 2. Extract hashtags from description/caption text
    const textHashtags = extractHashtags(descriptionText);
    hashtags.push(...textHashtags);
    
    // Remove duplicates and normalize
    const uniqueHashtags = [...new Set(hashtags.map(h => h.startsWith('#') ? h : `#${h}`))];

    // Step 3: Perform hashtag check (use processed record)
    const hashtagStatus = checkHashtags(
      processedRecord,
      contest.required_hashtags || [],
      platform
    );

    // Step 4: Perform description check (use processed record)
    const descriptionStatus = checkDescription(
      processedRecord,
      contest.required_description_template,
      platform
    );

    // Step 1: Extract and save video stats directly from BrightData payload
    // Use the EXACT same extraction logic as ingest_brightdata_snapshot_v2
    // IMPORTANT: This MUST execute before hashtag/description updates to ensure stats are saved
    
    console.log('[Contest Webhook] ===== STARTING STATS EXTRACTION =====', {
      submission_id: submission.id,
      has_processed_record: !!processedRecord,
      processed_record_type: typeof processedRecord,
      platform
    });
    
    if (!processedRecord) {
      console.error('[Contest Webhook] CRITICAL: processedRecord is null/undefined - cannot extract stats!');
      console.error('[Contest Webhook] Available data:', {
        has_record: !!record,
        has_processed_data: !!processedData,
        processed_data_length: processedData?.length,
        has_normalized_data: !!normalizedData,
        normalized_data_length: normalizedData?.length
      });
      // Continue anyway - hashtags might still work, but stats will be 0
    }
    
    // Get normalized_metrics if available (from attachNormalizedMetrics)
    const normalizedMetrics = processedRecord?.normalized_metrics || null;
    
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let saves = 0;

    // Extract stats using platform-specific logic (copied from ingestion function)
    if (!processedRecord) {
      console.error('[Contest Webhook] CRITICAL: Cannot extract stats - processedRecord is null');
      views = 0;
      likes = 0;
      comments = 0;
      shares = 0;
      saves = 0;
    } else if (platform === 'tiktok') {
      views = processedRecord.play_count || 0;
      likes = processedRecord.digg_count || 0;
      comments = processedRecord.comment_count || 0;
      shares = processedRecord.share_count || 0;
      saves = processedRecord.collect_count || 0;
    } else if (platform === 'youtube') {
      views = processedRecord.views || 0;
      likes = processedRecord.likes || 0;
      comments = processedRecord.num_comments || 0;
      shares = 0; // YouTube doesn't have shares
      saves = 0; // YouTube doesn't have saves
    } else {
      // Instagram (or fallback)
      views = processedRecord.video_play_count || 
              processedRecord.play_count || 
              processedRecord.views || 0;
      likes = processedRecord.likes || 
              processedRecord.digg_count || 0;
      comments = processedRecord.num_comments || 
                 processedRecord.comment_count || 0;
      shares = processedRecord.share_count || 0;
      saves = processedRecord.save_count || 
              processedRecord.collect_count || 0;
    }
    
    // Use normalized_metrics if available (same as ingestion function)
    if (normalizedMetrics) {
      views = normalizedMetrics.total_views ?? views;
      likes = normalizedMetrics.like_count ?? likes;
      comments = normalizedMetrics.comment_count ?? comments;
      shares = normalizedMetrics.share_count ?? shares;
      saves = normalizedMetrics.save_count ?? saves;
    }
    
    // Ensure all values are numbers
    views = Number(views) || 0;
    likes = Number(likes) || 0;
    comments = Number(comments) || 0;
    shares = Number(shares) || 0;
    saves = Number(saves) || 0;

    // Calculate impact score: 100 × comments + 0.001 × likes + views ÷ 100000
    const impactScore = Math.round(
      ((100.0 * comments) +
       (0.001 * likes) +
       (views / 100000.0)) * 100
    ) / 100; // Round to 2 decimal places
    
    console.log('[Contest Webhook] Extracted stats from BrightData:', {
      submission_id: submission.id,
      platform,
      views,
      likes,
      comments,
      shares,
      saves,
      impact_score: impactScore,
      has_normalized_metrics: !!normalizedMetrics,
      normalized_metrics: normalizedMetrics ? {
        total_views: normalizedMetrics.total_views,
        like_count: normalizedMetrics.like_count,
        comment_count: normalizedMetrics.comment_count,
        share_count: normalizedMetrics.share_count,
        save_count: normalizedMetrics.save_count,
      } : null,
      raw_fields: {
        play_count: processedRecord.play_count,
        video_play_count: processedRecord.video_play_count,
        views: processedRecord.views,
        digg_count: processedRecord.digg_count,
        like_count: processedRecord.like_count,
        comment_count: processedRecord.comment_count,
        num_comments: processedRecord.num_comments,
        share_count: processedRecord.share_count,
        collect_count: processedRecord.collect_count,
        save_count: processedRecord.save_count,
      }
    });

    // Save stats directly to database - ensure this happens
    // Also save the raw BrightData response for debugging
    const statsUpdateData: any = {
      views_count: views,
      likes_count: likes,
      comments_count: comments,
      shares_count: shares,
      saves_count: saves,
      impact_score: impactScore,
      stats_updated_at: new Date().toISOString(),
    };
    
    // Save the ORIGINAL BrightData response (not processed) for debugging
    // Use the original record from BrightData payload
    const originalBrightDataRecord = Array.isArray(data) && data.length > 0 ? data[0] : (record || processedRecord);
    
    if (originalBrightDataRecord && typeof originalBrightDataRecord === 'object') {
      try {
        // Ensure it's serializable - save the original BrightData response
        statsUpdateData.brightdata_response = JSON.parse(JSON.stringify(originalBrightDataRecord));
        console.log('[Contest Webhook] ✓ Prepared brightdata_response for saving:', {
          submission_id: submission.id,
          has_brightdata_response: true,
          response_keys: Object.keys(originalBrightDataRecord).slice(0, 20)
        });
      } catch (e) {
        console.warn('[Contest Webhook] Failed to serialize brightdata_response:', e);
        // Store a simplified version with error info
        statsUpdateData.brightdata_response = {
          error: 'Failed to serialize full response',
          error_message: e instanceof Error ? e.message : 'Unknown error',
          keys: Object.keys(originalBrightDataRecord).slice(0, 50),
          sample_data: Object.fromEntries(
            Object.entries(originalBrightDataRecord).slice(0, 10)
          )
        };
      }
    } else {
      console.warn('[Contest Webhook] Original BrightData record is invalid:', {
        submission_id: submission.id,
        has_data_array: Array.isArray(data),
        data_length: Array.isArray(data) ? data.length : 0,
        has_record: !!record,
        has_processed_record: !!processedRecord,
        type: typeof originalBrightDataRecord,
        is_null: originalBrightDataRecord === null,
        is_undefined: originalBrightDataRecord === undefined
      });
    }

    console.log('[Contest Webhook] Updating contest_submissions with stats:', {
      submission_id: submission.id,
      update_data_keys: Object.keys(statsUpdateData),
      update_data: {
        views_count: statsUpdateData.views_count,
        likes_count: statsUpdateData.likes_count,
        comments_count: statsUpdateData.comments_count,
        shares_count: statsUpdateData.shares_count,
        saves_count: statsUpdateData.saves_count,
        impact_score: statsUpdateData.impact_score,
        has_brightdata_response: !!statsUpdateData.brightdata_response
      }
    });

    // Try update without brightdata_response first (in case column doesn't exist)
    const statsUpdateDataWithoutResponse = {
      views_count: views,
      likes_count: likes,
      comments_count: comments,
      shares_count: shares,
      saves_count: saves,
      impact_score: impactScore,
      stats_updated_at: new Date().toISOString(),
    };

    let statsError: any = null;
    let updatedData: any = null;

    // First try with brightdata_response
    const updateResult = await supabaseAdmin
      .from('contest_submissions')
      .update(statsUpdateData)
      .eq('id', submission.id)
      .select('id, views_count, likes_count, comments_count, shares_count, saves_count, impact_score, stats_updated_at, brightdata_response');

    if (updateResult.error) {
      // If error, check if it's because brightdata_response column doesn't exist
      const isColumnError = updateResult.error.message?.includes('column') && 
                           updateResult.error.message?.includes('brightdata_response');
      
      if (isColumnError) {
        console.warn('[Contest Webhook] brightdata_response column may not exist, trying without it:', updateResult.error.message);
      } else {
        console.error('[Contest Webhook] Update failed with error:', {
          error: updateResult.error.message,
          code: updateResult.error.code,
          details: updateResult.error.details
        });
      }
      
      // Try without brightdata_response
      const updateResult2 = await supabaseAdmin
        .from('contest_submissions')
        .update(statsUpdateDataWithoutResponse)
        .eq('id', submission.id)
        .select('id, views_count, likes_count, comments_count, shares_count, saves_count, impact_score, stats_updated_at, brightdata_response');
      
      statsError = updateResult2.error;
      updatedData = updateResult2.data;
      
      if (!statsError && updateResult2.data) {
        console.warn('[Contest Webhook] Stats saved but brightdata_response was not saved (column may not exist)');
      }
    } else {
      statsError = updateResult.error;
      updatedData = updateResult.data;
      
      // Verify brightdata_response was saved
      if (updatedData && updatedData.length > 0 && updatedData[0].brightdata_response) {
        console.log('[Contest Webhook] ✓ brightdata_response saved successfully');
      } else if (statsUpdateData.brightdata_response) {
        console.warn('[Contest Webhook] ⚠ brightdata_response was in update but not returned in select - may not have been saved');
      }
    }

    if (statsError) {
      console.error('[Contest Webhook] ✗ CRITICAL: Failed to save video stats:', {
        submission_id: submission.id,
        error: statsError.message,
        code: statsError.code,
        details: statsError.details,
        hint: statsError.hint,
        update_data: statsUpdateData
      });
      // Don't throw - continue with other processing
    } else {
      if (updatedData && updatedData.length > 0) {
        const saved = updatedData[0];
        console.log('[Contest Webhook] ✓ Video stats saved successfully:', {
          submission_id: submission.id,
          saved_stats: {
            views_count: saved.views_count,
            likes_count: saved.likes_count,
            comments_count: saved.comments_count,
            shares_count: saved.shares_count,
            saves_count: saved.saves_count,
            impact_score: saved.impact_score,
            stats_updated_at: saved.stats_updated_at
          }
        });
        
        // Verify the stats were actually saved correctly
        if (saved.views_count !== views || saved.likes_count !== likes || saved.comments_count !== comments) {
          console.error('[Contest Webhook] ✗ CRITICAL: Stats mismatch after save!', {
            submission_id: submission.id,
            expected: { views, likes, comments, shares, saves },
            actual: {
              views: saved.views_count,
              likes: saved.likes_count,
              comments: saved.comments_count,
              shares: saved.shares_count,
              saves: saved.saves_count
            }
          });
        }
      } else {
        console.error('[Contest Webhook] ✗ CRITICAL: Update returned no rows - submission may not exist:', {
          submission_id: submission.id
        });
      }
    }

    // Step 2: Update hashtag and description statuses
    // IMPORTANT: Also ensure stats are saved here as a fallback if Step 1 failed
    const finalStatus =
      hashtagStatus === 'pass' && descriptionStatus === 'pass'
        ? 'approved'
        : 'waiting_review';

    const hashtagUpdateData: any = {
      hashtag_status: hashtagStatus,
      description_status: descriptionStatus,
      processing_status: finalStatus,
      description_text: descriptionText || null,
      hashtags_array: uniqueHashtags.length > 0 ? uniqueHashtags : null,
      // Ensure stats are saved here too as fallback
      views_count: views,
      likes_count: likes,
      comments_count: comments,
      shares_count: shares,
      saves_count: saves,
      impact_score: impactScore,
      stats_updated_at: new Date().toISOString(),
    };

    // Try to add brightdata_response to hashtag update as well (in case stats update didn't include it)
    // Use the original BrightData response (already defined above)
    if (originalBrightDataRecord && typeof originalBrightDataRecord === 'object') {
      try {
        hashtagUpdateData.brightdata_response = JSON.parse(JSON.stringify(originalBrightDataRecord));
      } catch (e) {
        console.warn('[Contest Webhook] Failed to serialize brightdata_response in hashtag update:', e);
      }
    }

    console.log('[Contest Webhook] Updating hashtag/description statuses and ensuring stats are saved:', {
      submission_id: submission.id,
      final_status: finalStatus,
      stats_included: {
        views_count: hashtagUpdateData.views_count,
        likes_count: hashtagUpdateData.likes_count,
        comments_count: hashtagUpdateData.comments_count,
      }
    });

    // Only include brightdata_response in hashtag update if it wasn't already saved in stats update
    // Check if stats update succeeded and included brightdata_response
    const statsUpdateSucceeded = !statsError && updatedData && updatedData.length > 0;
    const brightdataResponseAlreadySaved = statsUpdateSucceeded && updatedData[0].brightdata_response;
    
    if (brightdataResponseAlreadySaved) {
      // Don't include brightdata_response again - it's already saved
      delete hashtagUpdateData.brightdata_response;
      console.log('[Contest Webhook] Skipping brightdata_response in hashtag update (already saved in stats update)');
    } else if (!hashtagUpdateData.brightdata_response) {
      // Try to add it if it wasn't in the update data
      const originalBrightDataRecord = Array.isArray(data) && data.length > 0 ? data[0] : (record || processedRecord);
      if (originalBrightDataRecord && typeof originalBrightDataRecord === 'object') {
        try {
          hashtagUpdateData.brightdata_response = JSON.parse(JSON.stringify(originalBrightDataRecord));
          console.log('[Contest Webhook] Adding brightdata_response to hashtag update (was not saved in stats update)');
        } catch (e) {
          console.warn('[Contest Webhook] Failed to serialize brightdata_response in hashtag update:', e);
        }
      }
    }

    const { error: hashtagUpdateError } = await supabaseAdmin
      .from('contest_submissions')
      .update(hashtagUpdateData)
      .eq('id', submission.id)
      .select('id, brightdata_response');

    if (hashtagUpdateError) {
      console.error('[Contest Webhook] Failed to update hashtag/description/stats:', {
        submission_id: submission.id,
        error: hashtagUpdateError.message,
        code: hashtagUpdateError.code
      });
      // Try without brightdata_response if it failed
      if (hashtagUpdateData.brightdata_response) {
        delete hashtagUpdateData.brightdata_response;
        const { error: retryError } = await supabaseAdmin
          .from('contest_submissions')
          .update(hashtagUpdateData)
          .eq('id', submission.id)
          .select('id, brightdata_response');
        
        if (retryError) {
          console.error('[Contest Webhook] Retry also failed:', retryError.message);
        } else {
          console.log('[Contest Webhook] Hashtag update succeeded without brightdata_response');
        }
      }
    } else {
      // Verify brightdata_response was saved in hashtag update
      const hashtagUpdateResult = await supabaseAdmin
        .from('contest_submissions')
        .select('brightdata_response')
        .eq('id', submission.id)
        .single();
      
      if (hashtagUpdateResult.data?.brightdata_response) {
        console.log('[Contest Webhook] ✓ brightdata_response confirmed saved in database');
      } else if (hashtagUpdateData.brightdata_response) {
        console.warn('[Contest Webhook] ⚠ brightdata_response was in hashtag update but not found in database');
      }
    }

    // NOTE: Contest submissions now have their own independent flow
    // The normal ingestion flow (videos_hot) is triggered separately via process-submission route
    // This webhook ONLY handles contest_submissions and does NOT call ingestion
    console.log('[Contest Webhook] Contest submission flow completed - stats saved directly to contest_submissions');
    console.log('[Contest Webhook] Note: Normal ingestion (videos_hot) is handled by separate BrightData trigger');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contest Webhook] Error:', error);
    console.error('[Contest Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Contest Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoint: '/api/brightdata/contest-webhook'
  });
}

// Handle OPTIONS for CORS (BrightData may check this)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Extract metrics from BrightData response
 */
function extractMetrics(record: any, platform: string): {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
} {
  const { normalized_metrics } = normalizeBrightDataRecord(record, {
    platformHint: (platform || 'unknown') as Platform,
  });

  const fallback = {
    views:
      coalesceMetric(
        record.video_play_count,
        record.play_count,
        record.views,
        record.view_count,
        record.total_views,
      ) || 0,
    likes:
      coalesceMetric(
        record.likes,
        record.like_count,
        record.likes_count,
        record.digg_count,
      ) || 0,
    comments:
      coalesceMetric(
        record.num_comments,
        record.comment_count,
        record.comments_count,
        record.comments,
      ) || 0,
    shares:
      coalesceMetric(
        record.share_count,
        record.shares_count,
        record.shares,
      ) || 0,
    saves:
      coalesceMetric(
        record.save_count,
        record.saves_count,
        record.saves,
        record.collect_count,
      ) || 0,
  };

  // Use normalized metrics if available, otherwise fallback
  // But don't use 0 from normalized if fallback has a value
  const result = {
    views: normalized_metrics.total_views ?? fallback.views,
    likes: normalized_metrics.like_count ?? fallback.likes,
    comments: normalized_metrics.comment_count ?? fallback.comments,
    shares: normalized_metrics.share_count ?? fallback.shares,
    saves: normalized_metrics.save_count ?? fallback.saves,
  };

  // Log detailed extraction info for debugging
  console.log('[Contest Webhook] Metrics extraction details:', {
    platform,
    normalized_metrics: {
      total_views: normalized_metrics.total_views,
      like_count: normalized_metrics.like_count,
      comment_count: normalized_metrics.comment_count,
      share_count: normalized_metrics.share_count,
      save_count: normalized_metrics.save_count,
    },
    fallback_metrics: fallback,
    final_result: result,
  });

  if (result.comments === 0 && result.views === 0 && result.likes === 0) {
    console.warn('[Contest Webhook] ⚠ All metrics are zero - check BrightData payload:', {
      platform,
      url: record.url || record.video_url || record.post_url,
      record_sample: {
        play_count: record.play_count,
        video_play_count: record.video_play_count,
        views: record.views,
        likes: record.likes,
        digg_count: record.digg_count,
        comment_count: record.comment_count,
        num_comments: record.num_comments,
      },
      normalized_metrics,
      fallback,
    });
  }

  return result;
}

function coalesceMetric(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    const parsed = parseMetricValue(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseMetricValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && !Number.isNaN(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    // Handle empty strings
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    
    // Handle K/M/B suffixes (e.g., "1.5K", "2M", "1.2B")
    const match = trimmed.match(/([0-9][0-9.,]*)([kmb])?/);
    if (match) {
      const numericPortion = match[1].replace(/,/g, '');
      const base = Number(numericPortion);
      if (!Number.isNaN(base) && base >= 0) {
        const suffix = match[2];
        if (!suffix) return Math.round(base);
        const multiplier =
          suffix === 'k' ? 1_000 :
          suffix === 'm' ? 1_000_000 :
          suffix === 'b' ? 1_000_000_000 : 1;
        return Math.round(base * multiplier);
      }
    }
    // Try parsing as plain number
    const numeric = Number(trimmed.replace(/,/g, ''));
    if (!Number.isNaN(numeric) && numeric >= 0) return Math.round(numeric);
  }
  return 0;
}

/**
 * Check if required hashtags are present
 */
function checkHashtags(
  record: any,
  requiredHashtags: string[],
  platform: string
): 'pass' | 'fail' | 'pending_review' {
  if (requiredHashtags.length === 0) {
    return 'pass';
  }

  // Extract hashtags from multiple sources
  const hashtags: string[] = [];

  // 1. Check if BrightData provides a separate hashtags array
  if (record.hashtags) {
    if (Array.isArray(record.hashtags)) {
      // Handle different formats: array of strings or array of objects
      for (const item of record.hashtags) {
        if (typeof item === 'string') {
          hashtags.push(item);
        } else if (item && typeof item === 'object') {
          // Format: { hashtag: "#tag", link: "..." }
          if (item.hashtag) {
            hashtags.push(item.hashtag);
          } else if (item.tag) {
            hashtags.push(item.tag);
          }
        }
      }
    }
  }

  // 2. Extract hashtags from description/caption text
  const description = record.description || record.caption || record.text || '';
  const textHashtags = extractHashtags(description);
  hashtags.push(...textHashtags);

  // Remove duplicates
  const uniqueHashtags = [...new Set(hashtags)];

  // Normalize hashtags (remove # and lowercase)
  const normalizedRequired = requiredHashtags.map((h) =>
    h.replace('#', '').toLowerCase().trim()
  );
  const normalizedFound = uniqueHashtags.map((h) =>
    h.replace('#', '').toLowerCase().trim()
  );

  console.log('[Contest Webhook] Hashtag check:', {
    required: normalizedRequired,
    found: normalizedFound,
    platform,
  });

  // Check if all required hashtags are present
  // Use exact match or substring match (for variations like #tag vs #tagged)
  const allPresent = normalizedRequired.every((required) => {
    return normalizedFound.some((found) => {
      // Exact match
      if (found === required) return true;
      // Substring match (found contains required or vice versa)
      if (found.includes(required) || required.includes(found)) return true;
      return false;
    });
  });

  return allPresent ? 'pass' : 'fail';
}

/**
 * Extract hashtags from text using regex
 * Handles various formats: #tag, #TAG, #tag123, etc.
 */
function extractHashtags(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Match hashtags: # followed by word characters (letters, numbers, underscore)
  // Also handles unicode characters in hashtags
  const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
  const matches = text.match(hashtagRegex);
  return matches || [];
}

/**
 * Check if description matches template
 */
function checkDescription(
  record: any,
  template: string | null,
  platform: string
): 'pass' | 'fail' | 'pending_review' {
  if (!template) {
    return 'pass'; // No template required
  }

  // Get description from multiple possible fields
  const description = record.description || record.caption || record.text || record.title || '';
  
  if (!description || description.trim().length === 0) {
    console.log('[Contest Webhook] No description found in record');
    return 'fail';
  }

  const normalizedDescription = description.toLowerCase().trim();
  const normalizedTemplate = template.toLowerCase().trim();

  // First, try exact match (case-insensitive)
  if (normalizedDescription === normalizedTemplate) {
    return 'pass';
  }

  // Try substring match (description contains template)
  if (normalizedDescription.includes(normalizedTemplate)) {
    return 'pass';
  }

  // Extract key phrases from template (words longer than 3 chars, excluding common words)
  const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  
  const templateWords = normalizedTemplate
    .split(/\s+/)
    .map(w => w.replace(/[^\w]/g, '')) // Remove punctuation
    .filter((w) => w.length > 3 && !commonWords.has(w)); // Filter out short words and common words

  if (templateWords.length === 0) {
    // If template is too short or only common words, use substring match
    return normalizedDescription.includes(normalizedTemplate) ? 'pass' : 'fail';
  }

  // Check if key phrases from template appear in description
  const matches = templateWords.filter((word) =>
    normalizedDescription.includes(word)
  );

  // Calculate match ratio
  const matchRatio = matches.length / templateWords.length;
  
  console.log('[Contest Webhook] Description check:', {
    templateWords,
    matches: matches.length,
    totalWords: templateWords.length,
    matchRatio,
    platform,
  });

  // If at least 60% of key words match, consider it a pass
  // Increased threshold from 50% to 60% for better accuracy
  return matchRatio >= 0.6 ? 'pass' : 'fail';
}

