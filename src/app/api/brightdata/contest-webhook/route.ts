/**
 * BrightData webhook handler for contest submissions
 * Receives video stats data and updates contest submissions
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeBrightDataRecord } from '@/lib/brightdata-normalizer';
import { attachNormalizedMetrics } from '@/lib/brightdata-normalizer';
import { downloadAndStoreImage, isSupabaseUrl, storeImageWithDeduplication } from '@/lib/image-storage';
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

      submission = data;
      submissionError = error;

      if (submission) {
        console.log('[Contest Webhook] Found submission by URL (fallback):', videoUrl);
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

    // Step 1: Process images (download and store in Supabase Storage)
    // This must happen before ingestion so images are available
    console.log('[Contest Webhook] Processing images before ingestion...');
    const processedData = await processImagesInPayload(data);
    const processedRecord = processedData[0] || record;

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

    // Extract metrics from BrightData response (use processed record)
    // Note: Stats are now stored in videos_hot, not contest_submissions
    // We'll link video_hot_id after ingestion completes
    
    // Get platform from submission metadata or infer from URL
    const platform = submission.platform || 
      (videoUrl.includes('tiktok') ? 'tiktok' : 
       videoUrl.includes('instagram') ? 'instagram' : 
       videoUrl.includes('youtube') ? 'youtube' : 'unknown');

    // Update processing status (stats will come from videos_hot after ingestion)
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

    // Update statuses
    const finalStatus =
      hashtagStatus === 'pass' && descriptionStatus === 'pass'
        ? 'approved'
        : 'waiting_review';

    await supabaseAdmin
      .from('contest_submissions')
      .update({
        hashtag_status: hashtagStatus,
        description_status: descriptionStatus,
        processing_status: finalStatus,
        description_text: descriptionText || null,
        hashtags_array: uniqueHashtags.length > 0 ? uniqueHashtags : null,
      })
      .eq('id', submission.id);

    // Step 2: Trigger full ingestion pipeline to populate main database tables
    // This ensures contest submissions feed into communities, hashtag pages, etc.
    console.log('[Contest Webhook] Triggering full ingestion pipeline...');
    
    // Track ingestion attempt
    const finalSnapshotId = snapshotId || `contest_${submission.id}_${Date.now()}`;
    let ingestionSucceeded = false;
    let ingestionErrorDetails: any = null;
    
    try {
      // Retrieve submission metadata to get skip_validation flag
      let skipValidation = false;
      if (snapshotId) {
        const { data: metadata } = await supabaseAdmin
          .from('submission_metadata')
          .select('skip_validation')
          .eq('snapshot_id', snapshotId)
          .maybeSingle();
        
        if (metadata) {
          skipValidation = metadata.skip_validation ?? false;
        }
      }

      // Normalize the payload using the same logic as main webhook
      const normalizedPayload = processedData.map(rec => attachNormalizedMetrics(rec));

      console.log('[Contest Webhook] Calling ingest_brightdata_snapshot_v2 with:', {
        snapshot_id: finalSnapshotId,
        payload_count: normalizedPayload.length,
        skip_validation: skipValidation
      });

      // Call the ingestion function to populate videos_hot, creators_hot, hashtags_hot, etc.
      const { data: ingestionResult, error: ingestionError } = await supabaseAdmin.rpc(
        'ingest_brightdata_snapshot_v2',
        {
          p_snapshot_id: finalSnapshotId,
          p_dataset_id: '',
          p_payload: normalizedPayload,
          p_skip_validation: skipValidation,
        }
      );

      if (ingestionError) {
        ingestionErrorDetails = ingestionError;
        console.error('[Contest Webhook] Full ingestion RPC failed:', {
          error: ingestionError.message,
          code: ingestionError.code,
          details: ingestionError.details,
          hint: ingestionError.hint
        });
        
        // Log to bd_ingestions table
        await supabaseAdmin
          .from('bd_ingestions')
          .upsert({
            snapshot_id: finalSnapshotId,
            dataset_id: '',
            status: 'failed',
            error: ingestionError.message,
            raw_count: normalizedPayload.length,
            updated_at: new Date().toISOString()
          }, { onConflict: 'snapshot_id' });
      } else {
        console.log('[Contest Webhook] Full ingestion RPC completed:', ingestionResult);
        
        // Verify that video was actually created in videos_hot
        const videoUrl = record.url || record.video_url || record.post_url;
        if (videoUrl) {
          // Wait a moment for database to commit
          await sleep(500);
          
          const { data: videoCheck, error: videoCheckError } = await supabaseAdmin
            .from('videos_hot')
            .select('id, video_id, video_url')
            .eq('video_url', videoUrl)
            .maybeSingle();
          
          if (videoCheck) {
            ingestionSucceeded = true;
            console.log('[Contest Webhook] ✓ Verification: Video found in videos_hot:', {
              video_id: videoCheck.video_id,
              id: videoCheck.id
            });
            
            // Video found in videos_hot - ingestion successful
            // Note: Stats are now stored directly in contest_submissions, no linking needed
            console.log('[Contest Webhook] ✓ Video found in videos_hot - ingestion successful:', {
              submission_id: submission.id,
              video_id: videoCheck.video_id
            });
          } else {
            console.warn('[Contest Webhook] ⚠ Verification: Video NOT found in videos_hot after ingestion:', {
              videoUrl,
              error: videoCheckError?.message
            });
            
            // Try to find by standardized URL
            const standardizedUrl = videoUrl.split('?')[0].split('#')[0];
            const { data: videoCheck2 } = await supabaseAdmin
              .from('videos_hot')
              .select('id, video_id, video_url')
              .eq('video_url', standardizedUrl)
              .maybeSingle();
            
            if (videoCheck2) {
              ingestionSucceeded = true;
              console.log('[Contest Webhook] ✓ Verification: Video found in videos_hot (by standardized URL):', {
                video_id: videoCheck2.video_id,
                id: videoCheck2.id
              });
              
              // Video found in videos_hot - ingestion successful
              console.log('[Contest Webhook] ✓ Video found in videos_hot (standardized URL) - ingestion successful:', {
                submission_id: submission.id,
                video_id: videoCheck2.video_id
              });
            } else {
              console.error('[Contest Webhook] ✗ Verification FAILED: Video not in videos_hot after ingestion');
              ingestionErrorDetails = { message: 'Video not found in videos_hot after ingestion', videoUrl };
            }
          }
        } else {
          console.warn('[Contest Webhook] ⚠ Cannot verify ingestion - no video URL in payload');
        }
        
        // Log successful ingestion
        await supabaseAdmin
          .from('bd_ingestions')
          .upsert({
            snapshot_id: finalSnapshotId,
            dataset_id: '',
            status: ingestionSucceeded ? 'completed' : 'failed',
            error: ingestionSucceeded ? null : 'Video not found in videos_hot after ingestion',
            raw_count: normalizedPayload.length,
            updated_at: new Date().toISOString()
          }, { onConflict: 'snapshot_id' });
      }
    } catch (ingestionError) {
      ingestionErrorDetails = ingestionError;
      console.error('[Contest Webhook] Exception during full ingestion:', {
        error: ingestionError instanceof Error ? ingestionError.message : 'Unknown error',
        stack: ingestionError instanceof Error ? ingestionError.stack : undefined
      });
    }
    
    // Step 3: Fallback mechanism - if ingestion failed, trigger main webhook
    if (!ingestionSucceeded && ingestionErrorDetails) {
      console.log('[Contest Webhook] Ingestion failed, attempting fallback to main webhook...');
      
      try {
        // Get the app URL for webhook
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'https://www.sportsclips.io';
        const mainWebhookUrl = `${appUrl.replace(/\/+$/, '')}/api/brightdata/webhook`;
        
        console.log('[Contest Webhook] Triggering main webhook as fallback:', mainWebhookUrl);
        
        // Send the processed data to main webhook
        const fallbackResponse = await fetch(mainWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(processedData),
        });
        
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          console.log('[Contest Webhook] ✓ Fallback to main webhook succeeded:', fallbackResult);
          
          // Verify again after fallback
          await sleep(1000);
          const videoUrl = record.url || record.video_url || record.post_url;
          if (videoUrl) {
            const { data: videoCheck } = await supabaseAdmin
              .from('videos_hot')
              .select('id, video_id')
              .eq('video_url', videoUrl)
              .maybeSingle();
            
            if (videoCheck) {
              console.log('[Contest Webhook] ✓ Fallback verification: Video now in videos_hot');
              ingestionSucceeded = true;
              
              // Video found in videos_hot - ingestion successful
              console.log('[Contest Webhook] ✓ Video found in videos_hot (fallback) - ingestion successful:', {
                submission_id: submission.id,
                video_id: videoCheck.video_id
              });
            }
          }
        } else {
          const fallbackError = await fallbackResponse.text();
          console.error('[Contest Webhook] ✗ Fallback to main webhook failed:', {
            status: fallbackResponse.status,
            error: fallbackError
          });
        }
      } catch (fallbackError) {
        console.error('[Contest Webhook] ✗ Exception during fallback:', fallbackError);
      }
    }
    
    // Log final status
    if (ingestionSucceeded) {
      console.log('[Contest Webhook] ✓ Full ingestion pipeline completed successfully');
    } else {
      console.error('[Contest Webhook] ✗ Full ingestion pipeline failed:', ingestionErrorDetails);
    }

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

  const result = {
    views: normalized_metrics.total_views || fallback.views,
    likes: normalized_metrics.like_count || fallback.likes,
    comments: normalized_metrics.comment_count || fallback.comments,
    shares: normalized_metrics.share_count || fallback.shares,
    saves: normalized_metrics.save_count || fallback.saves,
  };

  if (result.comments === 0) {
    console.warn('[Contest Webhook] Missing comment metrics', {
      platform,
      url: record.url || record.video_url || record.post_url,
      num_comments: record.num_comments,
      comment_count: record.comment_count,
      comments_count: record.comments_count,
      comments_label: record.comments,
      metrics_comment: normalized_metrics.comment_count,
      fallback_comments: fallback.comments,
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

function parseMetricValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const match = trimmed.match(/([0-9][0-9.,]*)([kmb])?/);
    if (match) {
      const numericPortion = match[1].replace(/,/g, '');
      const base = Number(numericPortion);
      if (!Number.isNaN(base)) {
        const suffix = match[2];
        if (!suffix) return base;
        const multiplier =
          suffix === 'k' ? 1_000 :
          suffix === 'm' ? 1_000_000 :
          suffix === 'b' ? 1_000_000_000 : 1;
        return Math.round(base * multiplier);
      }
    }
    const numeric = Number(trimmed.replace(/,/g, ''));
    if (!Number.isNaN(numeric)) return numeric;
  }
  return null;
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

