import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession } from '@/lib/simple-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/simple-login
 * Authenticate user with email and password
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

    // Authenticate user
    let user;
    try {
      user = await authenticateUser(email, password);
    } catch (authError: any) {
      console.error('Authentication error:', authError);
      // Check if it's a table missing error
      if (authError.message?.includes('table not found') || authError.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Database table not found. Please run the SQL migration in Supabase SQL Editor. See SIMPLE_AUTH_SETUP.md for instructions.',
            code: 'SETUP_REQUIRED',
            details: 'The simple_users table does not exist. Run sql/039_simple_auth_users.sql in Supabase SQL Editor.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          error: authError.message || 'Authentication failed',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      );
    }

    if (!user) {
      console.log('Authentication failed for email:', email);
      return NextResponse.json(
        {
          error: 'Invalid email or password. Make sure the database table exists and the user is created.',
          code: 'AUTH_ERROR',
        },
        { status: 401 }
      );
    }

    // Create session
    const token = await createSession(user.id, user.email);
    
    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      message: 'Login successful',
    });

    // Ensure cookie is set in response
    // The createSession function should have already set it, but we'll verify
    const cookieValue = response.cookies.get('simple_auth_session')?.value;
    if (!cookieValue && token) {
      // If cookie wasn't set, set it manually
      response.cookies.set('simple_auth_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }

    return response;
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

