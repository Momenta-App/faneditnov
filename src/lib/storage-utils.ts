/**
 * Storage utility functions for constructing Supabase storage URLs
 */
import { envClient } from './env-client';

/**
 * Get the Supabase storage base URL
 */
export function getSupabaseStorageUrl(): string {
  return envClient.NEXT_PUBLIC_SUPABASE_URL || '';
}

/**
 * Construct a public Supabase storage URL for a file
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @returns Public URL to the file
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
  const baseUrl = getSupabaseStorageUrl();
  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL not configured');
    return '';
  }
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  // Remove leading slash from path if present
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Construct a public URL for a contest video submission
 * @param bucket - Storage bucket name (usually 'contest-videos')
 * @param path - File path within the bucket
 * @returns Public URL to the video file
 */
export function getContestVideoUrl(bucket: string, path: string): string {
  return getStoragePublicUrl(bucket, path);
}

