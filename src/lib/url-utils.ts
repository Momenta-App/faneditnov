/**
 * TikTok URL Utility Functions
 * Standardizes TikTok URLs to a consistent format across the application
 */

/**
 * Standardizes TikTok URLs to a consistent format
 * Handles mobile/desktop variations, tracking params, etc.
 * 
 * @param url - The raw TikTok URL
 * @returns Standardized URL in format: https://www.tiktok.com/@username/video/videoId
 * 
 * @example
 * standardizeTikTokUrl('https://www.tiktok.com/@user/video/123?is_from_webapp=1')
 * // Returns: 'https://www.tiktok.com/@user/video/123'
 */
export function standardizeTikTokUrl(url: string): string {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Extract the video path (e.g., /@username/video/1234567890)
    const pathMatch = urlObj.pathname.match(/\/(@[\w\.]+)\/video\/(\d+)/);
    
    if (!pathMatch) {
      // If no match, return the original URL cleaned of params
      return url.split('?')[0];
    }
    
    const [_, username, videoId] = pathMatch;
    
    // Build standardized URL: https://www.tiktok.com/@username/video/videoId
    return `https://www.tiktok.com/${username}/video/${videoId}`;
  } catch (error) {
    // If parsing fails, try basic cleanup
    return url.split('?')[0].trim();
  }
}

/**
 * Checks if a TikTok URL contains a video ID pattern
 * 
 * @param url - The URL to validate
 * @returns true if the URL appears to be a valid TikTok video URL
 * 
 * @example
 * isValidTikTokUrl('https://www.tiktok.com/@user/video/123') // true
 * isValidTikTokUrl('https://google.com') // false
 */
export function isValidTikTokUrl(url: string): boolean {
  return /tiktok\.com\/.+\/video\/\d+/.test(url);
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

