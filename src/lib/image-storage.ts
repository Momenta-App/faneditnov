import { supabaseAdmin } from './supabase';
import crypto from 'crypto';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'brightdata-results';

export type ImageType = 'video-cover' | 'creator-avatar' | 'sound-cover';

interface DownloadImageResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
}

/**
 * Download image from TikTok URL and upload to Supabase Storage
 * TikTok images are publicly accessible, no auth needed
 */
export async function downloadAndStoreImage(
  tiktokImageUrl: string,
  imageType: ImageType,
  entityId: string // video_id, creator_id, or sound_id
): Promise<DownloadImageResult> {
  try {
    if (!tiktokImageUrl || !tiktokImageUrl.startsWith('http')) {
      return { success: false, error: 'Invalid image URL' };
    }

    // Add headers to mimic browser request (TikTok may block headless requests)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    // Download image from TikTok with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(tiktokImageUrl, { 
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { 
          success: false, 
          error: `Failed to download: ${response.status} ${response.statusText}` 
        };
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const imageBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);

      // Determine file extension
      const ext = contentType.includes('png') ? 'png' 
        : contentType.includes('webp') ? 'webp' 
        : 'jpg';

      // Generate unique filename with path organization
      const hash = crypto.createHash('md5').update(tiktokImageUrl).digest('hex').slice(0, 8);
      const filename = `${imageType}/${entityId}-${hash}.${ext}`;

      if (!supabaseAdmin) {
        return { success: false, error: 'Supabase admin client not available' };
      }

      console.log(`[Image Storage] Uploading to bucket "${STORAGE_BUCKET}" with path: "${filename}"`, {
        imageType,
        entityId,
        hash,
        ext,
        bufferSize: buffer.length,
        contentType
      });

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(filename, buffer, {
          contentType,
          cacheControl: '31536000', // 1 year cache
          upsert: true // Overwrite if exists
        });

      if (error) {
        console.error('[Image Storage] Supabase upload error:', {
          bucket: STORAGE_BUCKET,
          filename,
          error: error.message,
          errorDetails: error
        });
        return { success: false, error: error.message };
      }

      console.log(`[Image Storage] Successfully uploaded to "${STORAGE_BUCKET}/${filename}"`, {
        path: data?.path,
        id: data?.id
      });

      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filename);

      return {
        success: true,
        supabaseUrl: publicUrlData.publicUrl
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return { success: false, error: 'Download timeout after 10 seconds' };
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('Image download/upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch process multiple images with rate limiting
 */
export async function batchProcessImages(
  images: Array<{ url: string; type: ImageType; entityId: string }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>(); // entityId -> supabaseUrl
  
  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    
    const promises = batch.map(async ({ url, type, entityId }) => {
      const result = await downloadAndStoreImage(url, type, entityId);
      if (result.success && result.supabaseUrl) {
        results.set(entityId, result.supabaseUrl);
      }
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Check if URL is already a Supabase storage URL
 */
export function isSupabaseUrl(url: string): boolean {
  if (!url) return false;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url.includes(supabaseUrl || '') && url.includes('/storage/');
}

/**
 * Find existing image in storage for a given entity
 * Returns the file path if found, null otherwise
 */
export async function findExistingImageInStorage(
  imageType: ImageType,
  entityId: string
): Promise<string | null> {
  if (!supabaseAdmin || !entityId) {
    return null;
  }

  try {
    // List files in the image type folder
    const { data: files, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(imageType, {
        search: entityId,
      });

    if (error) {
      console.warn(`[Image Storage] Error listing files for ${imageType}/${entityId}:`, error.message);
      return null;
    }

    // Find file that starts with entityId
    const matchingFile = files?.find((file) => file.name.startsWith(`${entityId}-`));
    
    if (matchingFile) {
      return `${imageType}/${matchingFile.name}`;
    }

    return null;
  } catch (error) {
    console.error(`[Image Storage] Error finding existing image:`, error);
    return null;
  }
}

/**
 * Get existing image URL from storage if it exists
 */
export async function getExistingImageUrl(
  imageType: ImageType,
  entityId: string
): Promise<string | null> {
  const existingPath = await findExistingImageInStorage(imageType, entityId);
  
  if (!existingPath) {
    return null;
  }

  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(existingPath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`[Image Storage] Error getting public URL for ${existingPath}:`, error);
    return null;
  }
}

/**
 * Store image with deduplication logic
 * Checks if image exists for entity, compares source URLs
 * If source URL is different, downloads and replaces; if same, reuses existing
 */
export async function storeImageWithDeduplication(
  sourceImageUrl: string,
  imageType: ImageType,
  entityId: string
): Promise<DownloadImageResult> {
  if (!sourceImageUrl || !sourceImageUrl.startsWith('http')) {
    return { success: false, error: 'Invalid image URL' };
  }

  // If already a Supabase URL, return it
  if (isSupabaseUrl(sourceImageUrl)) {
    return { success: true, supabaseUrl: sourceImageUrl };
  }

  // Check if image exists in storage for this entity
  const existingPath = await findExistingImageInStorage(imageType, entityId);
  
  if (existingPath) {
    // Image exists - check if source URL matches
    // Extract hash from existing filename: {entityId}-{hash}.{ext}
    const existingHash = existingPath.split('-')[1]?.split('.')[0];
    const newHash = crypto.createHash('md5').update(sourceImageUrl).digest('hex').slice(0, 8);
    
    if (existingHash === newHash) {
      // Same source URL - reuse existing image
      const existingUrl = await getExistingImageUrl(imageType, entityId);
      if (existingUrl) {
        console.log(`[Image Storage] Reusing existing image for ${imageType}/${entityId} (same source URL)`);
        return { success: true, supabaseUrl: existingUrl };
      }
    } else {
      // Different source URL - image has changed, replace it
      console.log(`[Image Storage] Source URL changed for ${imageType}/${entityId}, replacing image`);
      // Delete old file
      if (supabaseAdmin) {
        await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .remove([existingPath])
          .catch((err) => {
            console.warn(`[Image Storage] Error removing old image ${existingPath}:`, err);
          });
      }
    }
  }

  // Download and store new image (or replace if source URL changed)
  return await downloadAndStoreImage(sourceImageUrl, imageType, entityId);
}

