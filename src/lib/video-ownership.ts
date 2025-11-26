import { supabaseAdmin } from '@/lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

type Platform = 'tiktok' | 'instagram' | 'youtube';

export type SocialAccountRecord = {
  id: string;
  platform: Platform;
  username: string | null;
  profile_url: string | null;
  verification_status: 'PENDING' | 'VERIFIED' | 'FAILED';
};

export type OwnershipResolution =
  | { status: 'verified'; account: SocialAccountRecord }
  | { status: 'needs_verification'; account: SocialAccountRecord | null }
  | { status: 'missing'; account: null };

/**
 * Extracts useful identifiers (username/video id) from a standardized URL.
 */
export function extractVideoIdentifiers(
  standardizedUrl: string,
  platform: Platform
): { username?: string; videoId?: string } {
  const result: { username?: string; videoId?: string } = {};
  try {
    const urlObj = new URL(standardizedUrl);
    if (platform === 'tiktok') {
      const match = urlObj.pathname.match(/\/@([^/]+)\/video\/(\d+)/);
      if (match) {
        result.username = match[1];
        result.videoId = match[2];
      }
    } else if (platform === 'instagram') {
      const match = urlObj.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (match) {
        result.videoId = match[2];
      }
      const userMatch = urlObj.pathname.match(/\/([^/]+)\/(p|reel)\//);
      if (userMatch) {
        result.username = userMatch[1];
      }
    } else if (platform === 'youtube') {
      const match = urlObj.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (match) {
        result.videoId = match[1];
      }
      const channelMatch = urlObj.pathname.match(/\/@([^/]+)/);
      if (channelMatch) {
        result.username = channelMatch[1];
      }
    }
  } catch (err) {
    // Ignore URL parse errors – identifiers remain undefined
  }
  return result;
}

const normalizeHandle = (value?: string | null) =>
  value?.replace('@', '').toLowerCase().trim();

export function accountMatchesUrl(
  account: SocialAccountRecord,
  standardizedUrl: string,
  platform: Platform,
  usernameHint?: string
): boolean {
  const normalizedUrl = standardizedUrl.toLowerCase();
  const normalizedHint = normalizeHandle(usernameHint);

  const accountUsername = normalizeHandle(account.username);
  if (normalizedHint && accountUsername === normalizedHint) {
    return true;
  }

  const profileUrl = account.profile_url?.toLowerCase();
  if (profileUrl && normalizedUrl.includes(profileUrl)) {
    return true;
  }

  if (accountUsername && normalizedUrl.includes(accountUsername)) {
    return true;
  }

  // Platform-specific fallback for usernames embedded in URLs
  if (!normalizedHint) {
    const { username } = extractVideoIdentifiers(standardizedUrl, platform);
    const hinted = normalizeHandle(username);
    if (hinted && accountUsername === hinted) {
      return true;
    }
  }

  return false;
}

/**
 * Attempts to resolve a verified social account for a given URL.
 * When requireVerified is true, only VERIFIED accounts are considered valid.
 */
export async function resolveAccountOwnership(options: {
  userId: string;
  platform: Platform;
  standardizedUrl: string;
  requireVerified?: boolean;
}): Promise<OwnershipResolution> {
  const { userId, platform, standardizedUrl, requireVerified = true } = options;

  const { data: accounts, error } = await supabaseAdmin
    .from('social_accounts')
    .select('id, platform, username, profile_url, verification_status')
    .eq('user_id', userId)
    .eq('platform', platform);

  if (error) {
    throw new Error(`Failed to load social accounts: ${(error as PostgrestError).message}`);
  }

  if (!accounts || accounts.length === 0) {
    return { status: 'missing', account: null };
  }

  const eligibleAccounts = requireVerified
    ? accounts.filter((acc) => acc.verification_status === 'VERIFIED')
    : accounts;

  if (eligibleAccounts.length === 0) {
    return { status: 'needs_verification', account: null };
  }

  const { username } = extractVideoIdentifiers(standardizedUrl, platform);
  const matchedAccount = eligibleAccounts.find((acc) =>
    accountMatchesUrl(acc, standardizedUrl, platform, username)
  );

  if (!matchedAccount) {
    return requireVerified
      ? { status: 'missing', account: null }
      : { status: 'needs_verification', account: null };
  }

  if (matchedAccount.verification_status === 'VERIFIED') {
    return { status: 'verified', account: matchedAccount };
  }

  return { status: 'needs_verification', account: matchedAccount };
}


