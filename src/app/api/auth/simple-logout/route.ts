import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/simple-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/simple-logout
 * Clear session and log out user
 */
export async function POST(request: NextRequest) {
  try {
    await clearSession();

    return NextResponse.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

