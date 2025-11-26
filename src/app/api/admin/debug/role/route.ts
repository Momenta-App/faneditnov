/**
 * Debug endpoint to check current user's role
 * GET: Returns current user's role and profile information
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, handleAuthError, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debug/role
 * Get current user's role for debugging
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          authenticated: false,
          error: 'Not authenticated' 
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
      },
      message: `Current role: ${user.role}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('[Debug Role API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

