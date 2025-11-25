/**
 * Multi-Platform URL Utility Functions
 * Supports TikTok, Instagram, and YouTube Shorts URLs
 * 
 * @module url-utils
 */

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'unknown';

/**
 * Detects the platform from a URL
 * 
 * @param url - The URL to check
 * @returns The detected platform or 'unknown'
 */
export function detectPlatform(url: string): Platform {
  if (!url) return 'unknown';

  const normalized = url.toLowerCase();

  if (
    normalized.includes('tiktok.com') ||
    normalized.includes('vm.tiktok.com') ||
    normalized.includes('tiktokcdn.com') ||
    normalized.includes('ttwstatic.com') ||
    /tiktok\.com\/t\/[a-z0-9]+/i.test(url)
  ) {
    return 'tiktok';
  }

  if (
    normalized.includes('instagram.com') ||
    normalized.includes('instagr.am') ||
    normalized.includes('cdninstagram.com')
  ) {
    return 'instagram';
  }

  if (
    normalized.includes('youtube.com') ||
    normalized.includes('youtu.be') ||
    normalized.includes('googlevideo.com') ||
    normalized.includes('ytimg.com')
  ) {
    return 'youtube';
  }

  return 'unknown';
}

/**
 * Standardizes Instagram URLs to a consistent format
 * Handles mobile/desktop variations, tracking params, etc.
 * Supports both posts (/p/) and reels (/reel/)
 * 
 * @param url - The raw Instagram URL
 * @returns Standardized URL in format: https://www.instagram.com/p/{shortcode} or https://www.instagram.com/reel/{shortcode}
 * 
 * @example
 * standardizeInstagramUrl('https://www.instagram.com/p/ABC123/?utm_source=share')
 * // Returns: 'https://www.instagram.com/p/ABC123'
 */
export function standardizeInstagramUrl(url: string): string {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Extract the post/reel path (e.g., /p/ABC123 or /reel/XYZ789)
    // Instagram shortcodes are alphanumeric, typically 11 characters
    const pathMatch = urlObj.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    
    if (!pathMatch) {
      // If no match, return the original URL cleaned of params
      return url.split('?')[0];
    }
    
    const [_, type, shortcode] = pathMatch;
    
    // Build standardized URL: https://www.instagram.com/{type}/{shortcode}
    return `https://www.instagram.com/${type}/${shortcode}`;
  } catch (error) {
    // If parsing fails, try basic cleanup
    return url.split('?')[0].trim();
  }
}

/**
 * Checks if an Instagram URL contains a valid post/reel pattern
 * 
 * @param url - The URL to validate
 * @returns true if the URL appears to be a valid Instagram post/reel URL
 * 
 * @example
 * isValidInstagramUrl('https://www.instagram.com/p/ABC123') // true
 * isValidInstagramUrl('https://www.instagram.com/reel/XYZ789') // true
 * isValidInstagramUrl('https://google.com') // false
 */
export function isValidInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/.test(url);
}

/**
 * Standardizes TikTok URLs to a consistent format
 * Handles mobile/desktop variations, tracking params, etc.
 * Supports both regular TikTok URLs and vm.tiktok.com short links
 * 
 * @param url - The raw TikTok URL
 * @returns Standardized URL in format: https://www.tiktok.com/@username/video/{videoId}
 * 
 * @example
 * standardizeTikTokUrl('https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1')
 * // Returns: 'https://www.tiktok.com/@user/video/1234567890'
 */
export function standardizeTikTokUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Handle vm.tiktok.com short links - these redirect, but we can extract the path
    if (urlObj.hostname === 'vm.tiktok.com' || urlObj.hostname.includes('tiktok.com')) {
      // For short links, we'll need to follow redirects or extract from path
      // For now, return cleaned URL
      const path = urlObj.pathname;
      if (path && path !== '/') {
        return `https://www.tiktok.com${path}`.split('?')[0];
      }
    }
    
    // Handle regular tiktok.com URLs
    // Format: https://www.tiktok.com/@username/video/{videoId}
    const pathMatch = urlObj.pathname.match(/\/@([^\/]+)\/video\/(\d+)/);
    if (pathMatch) {
      const [, username, videoId] = pathMatch;
      return `https://www.tiktok.com/@${username}/video/${videoId}`;
    }
    
    // If no match, return cleaned URL
    return url.split('?')[0].trim();
  } catch (error) {
    // If parsing fails, try basic cleanup
    return url.split('?')[0].trim();
  }
}

/**
 * Checks if a TikTok URL contains a valid video pattern
 * 
 * @param url - The URL to validate
 * @returns true if the URL appears to be a valid TikTok video URL
 * 
 * @example
 * isValidTikTokUrl('https://www.tiktok.com/@user/video/1234567890') // true
 * isValidTikTokUrl('https://vm.tiktok.com/ABC123') // true
 * isValidTikTokUrl('https://google.com') // false
 */
export function isValidTikTokUrl(url: string): boolean {
  return /tiktok\.com\/@[^\/]+\/video\/\d+/.test(url) || 
         /vm\.tiktok\.com/.test(url) ||
         /tiktok\.com\/t\/[A-Za-z0-9]+/.test(url);
}

/**
 * Standardizes YouTube Shorts URLs to a consistent format
 * ONLY accepts YouTube Shorts URLs (not regular YouTube videos)
 * Handles both youtube.com/shorts/ and youtu.be/ formats
 * 
 * @param url - The raw YouTube Shorts URL
 * @returns Standardized URL in format: https://www.youtube.com/shorts/{videoId}
 * @throws Error if URL is not a YouTube Shorts URL
 * 
 * @example
 * standardizeYouTubeUrl('https://youtu.be/ABC123?si=xyz')
 * // Returns: 'https://www.youtube.com/shorts/ABC123'
 */
export function standardizeYouTubeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Handle youtu.be short links (these are typically Shorts)
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.replace(/^\//, '');
      if (videoId) {
        return `https://www.youtube.com/shorts/${videoId}`;
      }
    }
    
    // Handle youtube.com/shorts/ format (ONLY Shorts format accepted)
    const shortsMatch = urlObj.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortsMatch) {
      const [, videoId] = shortsMatch;
      return `https://www.youtube.com/shorts/${videoId}`;
    }
    
    // Reject regular youtube.com/watch?v= format - these are NOT Shorts
    // Regular YouTube videos are not accepted
    if (urlObj.pathname.includes('/watch')) {
      throw new Error('Regular YouTube videos are not accepted. Only YouTube Shorts URLs are allowed.');
    }
    
    // If no match, throw error
    throw new Error('Invalid YouTube Shorts URL format');
  } catch (error) {
    // Re-throw if it's already an Error, otherwise create new one
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid YouTube Shorts URL');
  }
}

/**
 * Checks if a YouTube URL is a valid Shorts URL
 * ONLY accepts YouTube Shorts URLs (rejects regular YouTube videos)
 * 
 * @param url - The URL to validate
 * @returns true if the URL appears to be a valid YouTube Shorts URL
 * 
 * @example
 * isValidYouTubeUrl('https://www.youtube.com/shorts/ABC123') // true
 * isValidYouTubeUrl('https://youtu.be/ABC123') // true
 * isValidYouTubeUrl('https://www.youtube.com/watch?v=ABC123') // false (regular video)
 * isValidYouTubeUrl('https://google.com') // false
 */
export function isValidYouTubeUrl(url: string): boolean {
  // Only accept Shorts format or youtu.be (which are typically Shorts)
  // Explicitly reject regular /watch URLs
  if (/youtube\.com\/watch/.test(url)) {
    return false; // Regular YouTube videos are not accepted
  }
  
  return /youtube\.com\/shorts\/[A-Za-z0-9_-]+/.test(url) || 
         /youtu\.be\/[A-Za-z0-9_-]+/.test(url);
}

/**
 * Standardizes a URL based on its platform
 * 
 * @param url - The URL to standardize
 * @returns Standardized URL
 * @throws Error if YouTube URL is not a Shorts URL
 */
export function standardizeUrl(url: string): string {
  const platform = detectPlatform(url);
  switch (platform) {
    case 'tiktok':
      return standardizeTikTokUrl(url);
    case 'instagram':
      return standardizeInstagramUrl(url);
    case 'youtube':
      return standardizeYouTubeUrl(url);
    default:
      return url.split('?')[0].trim();
  }
}

/**
 * Validates if a URL is supported (TikTok, Instagram, or YouTube)
 * 
 * @param url - The URL to validate
 * @returns true if the URL is a supported platform
 */
export function isValidUrl(url: string): boolean {
  return isValidTikTokUrl(url) || isValidInstagramUrl(url) || isValidYouTubeUrl(url);
}

/**
 * Checks if a hashtag contains the word "edit" (case-insensitive)
 * 
 * @param hashtag - The hashtag to check (with or without #)
 * @returns true if the hashtag contains "edit"
 * 
 * @example
 * hasEditHashtag('edit') // true
 * hasEditHashtag('creededit') // true
 * hasEditHashtag('NBAedit') // true
 * hasEditHashtag('funny') // false
 */
export function hasEditHashtag(hashtag: string | string[]): boolean {
  const tags = Array.isArray(hashtag) ? hashtag : [hashtag];
  
  return tags.some(tag => {
    const normalized = tag.toLowerCase().replace('#', '');
    return normalized.includes('edit');
  });
}

