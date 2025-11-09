import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 * Sign out user and clear session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();

    // Sign out
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return NextResponse.json(
        {
          error: error.message || 'Failed to sign out',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Logged out successfully',
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

