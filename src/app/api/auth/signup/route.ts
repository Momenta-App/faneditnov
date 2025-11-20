import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { envClient } from '@/lib/env-client';
import { envServer } from '@/lib/env-server';
import { validatePassword } from '@/lib/password-utils';
import { getClientIP, checkAuthRateLimit, recordAuthAttempt } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/signup
 * Create a new user account
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIP(request);
    const rateLimit = await checkAuthRateLimit(ip, 'signup', 60, 3); // 3 attempts per hour
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many signup attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            resetAt: rateLimit.resetAt.toISOString(),
            remaining: rateLimit.remaining,
          },
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { email, password, display_name, invite_code } = body;

    // Validate input
    if (!email || !password) {
      // Record failed attempt for rate limiting
      await recordAuthAttempt(ip, 'signup', false);
      return NextResponse.json(
        {
          error: 'Email and password are required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate invite code
    if (!invite_code) {
      await recordAuthAttempt(ip, 'signup', false);
      return NextResponse.json(
        {
          error: 'Invite code is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Check invite code against environment variable
    const validInviteCode = envServer.SIGNUP_INVITE_CODE;
    if (invite_code !== validInviteCode) {
      await recordAuthAttempt(ip, 'signup', false);
      return NextResponse.json(
        {
          error: 'Invalid invite code',
          code: 'INVALID_INVITE_CODE',
        },
        { status: 403 }
      );
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      // Record failed attempt for rate limiting
      await recordAuthAttempt(ip, 'signup', false);
      return NextResponse.json(
        {
          error: passwordValidation.errors[0],
          code: 'VALIDATION_ERROR',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // For signup, use the anon key directly
    // Check env vars first
    if (!envClient.NEXT_PUBLIC_SUPABASE_URL || !envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase env vars:', {
        hasUrl: !!envClient.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });
      throw new Error('Missing Supabase environment variables');
    }
    
    console.log('Creating Supabase client for signup...');
    const supabase = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    console.log('Supabase client created successfully');

    // Create user in Supabase Auth
    console.log('Attempting to create user with email:', email);
    
    // Set redirect URL for email verification (if enabled in Supabase)
    // Get from request origin first (most reliable), then env vars
    const requestOrigin = request.headers.get('origin') || request.nextUrl.origin;
    const baseUrl = 
      requestOrigin && !requestOrigin.includes('localhost') 
        ? requestOrigin
        : (process.env.NEXT_PUBLIC_APP_URL || 
           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
    
    console.log('Creating user account (email confirmation should be disabled in Supabase dashboard)');
    
    // Sign up user - if email confirmation is disabled in Supabase, session will be returned
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: display_name || null,
        },
        // Only set emailRedirectTo if email confirmation is enabled
        // If disabled in Supabase dashboard, this won't be used
        emailRedirectTo: `${baseUrl}/auth/callback`,
      },
    });

    if (authError) {
      console.error('❌ Supabase Auth signup error:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        code: (authError as any).code,
        fullError: JSON.stringify(authError, null, 2),
      });
      
      // Record failed attempt for rate limiting
      await recordAuthAttempt(ip, 'signup', false);
      
      // Return the actual Supabase error message
      const supabaseMessage = authError.message || 'Failed to create account';
      return NextResponse.json(
        {
          error: supabaseMessage,
          code: 'AUTH_ERROR',
          details: {
            status: authError.status,
            name: authError.name,
            message: authError.message,
            code: (authError as any).code,
          },
        },
        { status: 400 }
      );
    }

    console.log('✅ User created successfully:', authData.user?.id);
    
    // Record successful attempt for rate limiting
    await recordAuthAttempt(ip, 'signup', true);

    if (!authData.user) {
      return NextResponse.json(
        {
          error: 'Failed to create user',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      );
    }

    // Wait a moment for the trigger to create the profile
    // Then verify profile exists or create it
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if profile was created by trigger
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If profile doesn't exist, create it (fallback if trigger failed)
    if (profileError || !profile) {
      console.log('Profile not found by trigger, creating manually...');
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          display_name: display_name || null,
          role: 'standard',
          email_verified: authData.user.email_confirmed_at !== null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        // Return detailed error for debugging
        return NextResponse.json(
          {
            error: `Database error saving profile: ${createError.message || 'Unknown error'}`,
            code: 'PROFILE_CREATION_ERROR',
            details: createError,
          },
          { status: 500 }
        );
      }
      
      console.log('Profile created successfully via fallback');
    } else if (display_name && profile.display_name !== display_name) {
      // Update display name if provided
      await supabaseAdmin
        .from('profiles')
        .update({ display_name })
        .eq('id', authData.user.id);
    }

    // Return session
    return NextResponse.json({
      user: authData.user,
      session: authData.session,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('❌ Unexpected signup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      type: typeof error,
      error: error,
    });
    
    return NextResponse.json(
      {
        error: `Database error saving new user: ${errorMessage}`,
        code: 'INTERNAL_ERROR',
        details: {
          message: errorMessage,
          stack: errorStack,
          type: typeof error,
        },
      },
      { status: 500 }
    );
  }
}

