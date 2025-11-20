import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, verifySession } from '@/lib/simple-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/simple-session
 * Get current session and user info
 */
export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie
    const token = request.cookies.get('simple_auth_session')?.value;
    
    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 200 }
      );
    }

    // Verify session
    const user = await verifySession(token);

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

