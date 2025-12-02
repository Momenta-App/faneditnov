export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube'

/**
 * Generate a random 6-character alphanumeric verification code
 */
export function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Extract username/handle from a profile URL
 */
export function extractUsernameFromUrl(url: string, platform: SocialPlatform): string | null {
  try {
    const urlObj = new URL(url)

    switch (platform) {
      case 'tiktok': {
        // TikTok URLs: https://www.tiktok.com/@username
        const match = urlObj.pathname.match(/^\/@([^\/]+)/)
        if (match) return match[1]
        // Also handle: https://vm.tiktok.com/... (can't extract username from short URLs)
        return null
      }
      case 'instagram': {
        // Instagram URLs: https://www.instagram.com/username/
        const match = urlObj.pathname.match(/^\/([^\/]+)/)
        if (match && match[1] !== 'p' && match[1] !== 'reel' && match[1] !== 'stories') {
          return match[1]
        }
        return null
      }
      case 'youtube': {
        // YouTube URLs can be:
        // - https://www.youtube.com/@username
        // - https://www.youtube.com/c/username
        // - https://www.youtube.com/channel/CHANNEL_ID
        const pathname = urlObj.pathname

        // Handle @username format
        const atMatch = pathname.match(/^\/@([^\/]+)/)
        if (atMatch) return atMatch[1]

        // Handle /c/username format
        const cMatch = pathname.match(/^\/c\/([^\/]+)/)
        if (cMatch) return cMatch[1]

        // Handle /channel/CHANNEL_ID (can't extract username from channel ID)
        if (pathname.startsWith('/channel/')) {
          return null
        }

        // Handle /user/username format (legacy)
        const userMatch = pathname.match(/^\/user\/([^\/]+)/)
        if (userMatch) return userMatch[1]

        return null
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Validate that a URL matches the expected format for a platform
 */
export function validateProfileUrl(url: string, platform: SocialPlatform): boolean {
  try {
    const urlObj = new URL(url)

    switch (platform) {
      case 'tiktok': {
        // Must be tiktok.com domain
        if (!urlObj.hostname.includes('tiktok.com')) return false
        // Must have @username in path or be a valid tiktok.com URL
        return urlObj.pathname.startsWith('/@') || urlObj.hostname === 'vm.tiktok.com'
      }
      case 'instagram': {
        // Must be instagram.com domain
        if (!urlObj.hostname.includes('instagram.com')) return false
        // Must have a username path (not /p/, /reel/, /stories/)
        const pathMatch = urlObj.pathname.match(/^\/([^\/]+)/)
        return pathMatch !== null && !['p', 'reel', 'stories', 'explore', 'accounts'].includes(pathMatch[1])
      }
      case 'youtube': {
        // Must be youtube.com domain
        if (!urlObj.hostname.includes('youtube.com')) return false
        // Must have @username, /c/, /channel/, or /user/ in path
        // Also allow /about suffix for profile collection (e.g., /@username/about)
        const pathname = urlObj.pathname.replace(/\/about$/, '') // Remove /about for validation
        return (
          pathname.startsWith('/@') ||
          pathname.startsWith('/c/') ||
          pathname.startsWith('/channel/') ||
          pathname.startsWith('/user/')
        )
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Parse a URL and identify the platform
 * Returns the platform and username if detected
 */
export function parseProfileUrl(url: string): {
  platform: SocialPlatform | null
  username: string | null
} {
  try {
    // Add https if missing for parsing
    let urlToParse = url.trim()
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      urlToParse = `https://${urlToParse}`
    }

    const urlObj = new URL(urlToParse)
    const hostname = urlObj.hostname.toLowerCase()

    // Check for TikTok
    if (hostname.includes('tiktok.com')) {
      const username = extractUsernameFromUrl(urlToParse, 'tiktok')
      return { platform: 'tiktok', username }
    }

    // Check for Instagram
    if (hostname.includes('instagram.com')) {
      const username = extractUsernameFromUrl(urlToParse, 'instagram')
      return { platform: 'instagram', username }
    }

    // Check for YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const username = extractUsernameFromUrl(urlToParse, 'youtube')
      return { platform: 'youtube', username }
    }

    // Not a supported platform
    return { platform: null, username: null }
  } catch {
    return { platform: null, username: null }
  }
}

/**
 * Normalize a profile URL (ensure https, remove trailing slashes)
 */
export function normalizeProfileUrl(url: string): string {
  try {
    // Add https if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }

    const urlObj = new URL(url)
    // Remove trailing slash from pathname
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '')
    // Remove query params and hash
    urlObj.search = ''
    urlObj.hash = ''

    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * Extract bio text from BrightData profile response
 * Platform-specific extraction based on Bright Data API response format
 */
export function extractBioFromProfileData(
  profileData: any,
  platform: SocialPlatform
): string {
  switch (platform) {
    case 'tiktok':
      // TikTok Profile API returns: biography (primary), signature, or bio
      // Check biography first as it's the primary field according to docs
      if (profileData.biography && typeof profileData.biography === 'string') {
        return profileData.biography
      }
      // Fallback to signature or bio
      return (
        profileData.signature ||
        profileData.bio ||
        profileData.bio_text ||
        profileData.description ||
        ''
      )
    case 'instagram':
      // Instagram may have biography at top level or nested in account object
      // Check top level first
      if (profileData.biography && typeof profileData.biography === 'string') {
        return profileData.biography
      }
      // Check nested account.biography (BrightData sometimes nests Instagram data)
      if (profileData.account && typeof profileData.account === 'object') {
        if (profileData.account.biography && typeof profileData.account.biography === 'string') {
          return profileData.account.biography
        }
        if (profileData.account.bio && typeof profileData.account.bio === 'string') {
          return profileData.account.bio
        }
      }
      // Fallback to other top-level fields
      return (
        profileData.bio ||
        profileData.bio_text ||
        profileData.description ||
        ''
      )
    case 'youtube':
      // YouTube uses Description (capital D) or description (lowercase)
      // Check both cases as Bright Data may return either
      if (profileData.Description && typeof profileData.Description === 'string') {
        return profileData.Description.trim()
      }
      if (profileData.description && typeof profileData.description === 'string') {
        return profileData.description.trim()
      }
      return (
        profileData.about ||
        profileData.about_text ||
        profileData.bio ||
        profileData.bio_text ||
        ''
      )
    default:
      // Generic fallback - try common field names
      const possibleFields = [
        'biography',
        'bio',
        'Description',
        'description',
        'bio_text',
        'description_text',
        'about',
        'about_text',
        'signature',
      ]
      for (const field of possibleFields) {
        if (profileData[field] && typeof profileData[field] === 'string') {
          return profileData[field]
        }
      }
      return ''
  }
}

/**
 * Check if verification code exists in bio/description text
 */
export function verifyCodeInBio(bioText: string, verificationCode: string): boolean {
  if (!bioText || !verificationCode) return false

  // Normalize the bio text (remove extra whitespace, convert to lowercase for comparison)
  const normalizedBio = bioText.replace(/\s+/g, ' ').trim()
  const normalizedCode = verificationCode.trim()

  // Check if code exists in bio (case-insensitive, allow for spacing)
  return normalizedBio.toLowerCase().includes(normalizedCode.toLowerCase())
}

