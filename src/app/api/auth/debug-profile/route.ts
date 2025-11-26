import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionFromRequest, getServerUserIdFromRequest } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/debug-profile
 * Debug endpoint to check what profile data is being returned
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSessionFromRequest(request);
    const userId = await getServerUserIdFromRequest(request);

    if (!session || !userId) {
      return NextResponse.json({
        authenticated: false,
        message: 'Not authenticated',
      });
    }

    // Fetch profile directly from database using admin client
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Also check auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    return NextResponse.json({
      authenticated: true,
      userId,
      userEmail: session.user.email,
      profile: profile || null,
      profileError: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      } : null,
      authUser: authUser?.user || null,
      authError: authError ? {
        message: authError.message,
      } : null,
      sessionInfo: {
        hasSession: !!session,
        userId: session.user.id,
        email: session.user.email,
      },
    });
  } catch (error) {
    console.error('Debug profile error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

