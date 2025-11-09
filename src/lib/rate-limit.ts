import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase';

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for IP (order matters - most trusted first)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback to 'unknown' if no IP can be determined
  return 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check IP-based rate limit for authentication attempts
 */
export async function checkAuthRateLimit(
  ip: string,
  action: 'login' | 'signup' | 'password-reset' | 'forgot-password',
  windowMinutes: number = 15,
  maxAttempts: number = 5
): Promise<RateLimitResult> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    // Query auth attempts from the rate limit window
    const { data: recentAttempts, error } = await supabaseAdmin
      .from('auth_rate_limits')
      .select('created_at')
      .eq('ip_address', ip)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error checking auth rate limit:', error);
      // On error, allow the request (fail open) but log the error
      return { allowed: true, remaining: maxAttempts, resetAt: new Date() };
    }

    const attemptCount = recentAttempts?.length || 0;
    const allowed = attemptCount < maxAttempts;
    const remaining = Math.max(0, maxAttempts - attemptCount);
    
    // Calculate reset time (window from oldest attempt, or now if no attempts)
    const resetAt = recentAttempts && recentAttempts.length > 0 && recentAttempts[recentAttempts.length - 1]?.created_at
      ? new Date(new Date(recentAttempts[recentAttempts.length - 1].created_at).getTime() + windowMinutes * 60 * 1000)
      : new Date(Date.now() + windowMinutes * 60 * 1000);

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error('Error in checkAuthRateLimit:', error);
    // Fail open on error
    return { allowed: true, remaining: maxAttempts, resetAt: new Date() };
  }
}

/**
 * Record an authentication attempt for rate limiting
 */
export async function recordAuthAttempt(
  ip: string,
  action: 'login' | 'signup' | 'password-reset' | 'forgot-password',
  success: boolean = false
): Promise<void> {
  try {
    await supabaseAdmin
      .from('auth_rate_limits')
      .insert({
        ip_address: ip,
        action,
        success,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error recording auth attempt:', error);
    // Don't fail the request if recording fails
  }
}

/**
 * Clean up old rate limit records (call periodically)
 */
export async function cleanupOldRateLimits(daysToKeep: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    await supabaseAdmin
      .from('auth_rate_limits')
      .delete()
      .lt('created_at', cutoffDate.toISOString());
  } catch (error) {
    console.error('Error cleaning up old rate limits:', error);
  }
}

