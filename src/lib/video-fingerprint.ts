import { createHash } from 'crypto';

/**
 * Generates a stable fingerprint for a video URL by lowercasing and hashing it.
 * This must stay in sync with Postgres generated columns that use md5(lower(url)).
 */
export function createVideoFingerprint(url: string): string {
  return createHash('md5').update(url.toLowerCase()).digest('hex');
}

