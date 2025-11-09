import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { envClient } from '@/lib/env-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'Email and password are required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // For login, create a client with cookies
    const cookieStore = await cookies();
    
    const supabase = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Cookie: cookieStore.toString(),
          },
        },
      }
    );

    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return NextResponse.json(
        {
          error: error.message || 'Invalid email or password',
          code: 'AUTH_ERROR',
        },
        { status: 401 }
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        {
          error: 'Failed to create session',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      );
    }

    // Return session - client will use setSession() to set it
    // Cookies will be set automatically by Supabase client on the client side
    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

