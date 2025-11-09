import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { envClient } from '@/lib/env-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Reset user password using the token from email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, token } = body;

    // Validate input
    if (!password) {
      return NextResponse.json(
        {
          error: 'Password is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        {
          error: 'Reset token is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        {
          error: 'Password must be at least 6 characters long',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Update password using the token
    // The token is typically extracted from the URL hash fragment after redirect
    const { data, error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error('Password reset error:', error);
      
      // Handle expired or invalid token
      if (error.message.includes('token') || error.message.includes('expired')) {
        return NextResponse.json(
          {
            error: 'Password reset link is invalid or has expired. Please request a new one.',
            code: 'INVALID_TOKEN',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: error.message || 'Failed to reset password',
          code: 'AUTH_ERROR',
        },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        {
          error: 'Failed to reset password',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Password reset successful',
      user: data.user,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

