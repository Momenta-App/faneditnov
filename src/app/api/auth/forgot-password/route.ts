import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { envClient } from '@/lib/env-client';
import { getClientIP, checkAuthRateLimit, recordAuthAttempt } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Send password reset email to user
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIP(request);
    const rateLimit = await checkAuthRateLimit(ip, 'forgot-password', 60, 3); // 3 attempts per hour
    
    if (!rateLimit.allowed) {
      // For security, don't reveal rate limiting, just return generic message
      return NextResponse.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      // Record failed attempt for rate limiting
      await recordAuthAttempt(ip, 'forgot-password', false);
      return NextResponse.json(
        {
          error: 'Email is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Create Supabase client for password reset
    const supabase = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Send password reset email
    // Supabase will send an email with a reset token link
    // The redirect URL will point to our reset password page
    // Get from request origin first (most reliable), then env vars
    const requestOrigin = request.headers.get('origin') || request.nextUrl.origin;
    const baseUrl = 
      requestOrigin && !requestOrigin.includes('localhost') 
        ? requestOrigin
        : (process.env.NEXT_PUBLIC_APP_URL || 
           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`,
    });

    // Always record as successful attempt (we don't reveal if email exists for security)
    await recordAuthAttempt(ip, 'forgot-password', true);

    if (error) {
      console.error('Password reset error:', error);
      // For security, don't reveal whether email exists or not
      // Always return success to prevent email enumeration
      return NextResponse.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    // Success - but we still don't reveal if email exists
    return NextResponse.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

