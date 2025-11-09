/**
 * Quota management utilities for rate limiting
 */
import { supabaseAdmin } from './supabase';
import type { UserRole } from './auth-utils';

export interface QuotaStatus {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Quota limits per role (configurable via env vars)
 */
export const QUOTA_LIMITS: Record<UserRole, number> = {
  standard: parseInt(process.env.STANDARD_SUBMISSION_LIMIT || '1'),
  creator: parseInt(process.env.CREATOR_SUBMISSION_LIMIT || '10'),
  brand: parseInt(process.env.BRAND_SUBMISSION_LIMIT || '5'),
  admin: Infinity,
};

/**
 * Check if user can submit a video URL based on their quota
 */
export async function checkVideoSubmissionQuota(
  userId: string,
  role: UserRole
): Promise<QuotaStatus> {
  const limit = QUOTA_LIMITS[role];

  if (limit === Infinity) {
    // Admin has unlimited
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    return {
      allowed: true,
      limit: Infinity,
      current: 0,
      remaining: Infinity,
      resetAt: tomorrow,
    };
  }

  // Get current quota status from database function
  const { data, error } = await supabaseAdmin.rpc('get_user_quota_status', {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    console.error('Error checking quota:', error);
    console.error('RPC params:', { userId, role });
    // On error, allow the request (fail open for availability)
    return {
      allowed: true,
      limit,
      current: 0,
      remaining: limit,
      resetAt: getNextMidnight(),
    };
  }

  console.log('Quota RPC response:', { userId, role, data });

  const quota = data as {
    limit: number;
    current: number;
    remaining: number;
    allowed: boolean;
    date: string;
  };

  return {
    allowed: quota.allowed,
    limit: quota.limit,
    current: quota.current,
    remaining: quota.remaining,
    resetAt: getNextMidnight(),
  };
}

/**
 * Record a video submission (increment quota counter)
 */
export async function recordVideoSubmission(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_video_submission_quota', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error recording video submission:', error);
    // Non-fatal, log but don't throw
  }
}

/**
 * Get next midnight UTC for quota reset time
 */
function getNextMidnight(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

