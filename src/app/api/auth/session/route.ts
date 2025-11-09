import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionFromRequest, getServerUserIdFromRequest } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Profile } from '@/app/types/data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session
 * Get current session and user profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSessionFromRequest(request);
    const userId = await getServerUserIdFromRequest(request);

    if (!session || !userId) {
      return NextResponse.json({
        user: null,
        profile: null,
        session: null,
      });
    }

    // Fetch profile
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it (fallback)
    if (error || !profile) {
      console.log('Profile not found, creating fallback profile for user:', userId);
      console.log('Profile fetch error:', error);
      console.log('Session user email:', session.user.email);
      
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: session.user.email!,
          role: 'standard',
          email_verified: session.user.email_confirmed_at !== null,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile fallback:', {
          message: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
          userId,
          email: session.user.email,
        });
        // Still return user even without profile - UI can handle it
        return NextResponse.json({
          user: session.user,
          profile: null,
          session,
        });
      }

      console.log('✅ Profile created successfully via fallback:', {
        id: newProfile?.id,
        email: newProfile?.email,
        role: newProfile?.role,
      });
      return NextResponse.json({
        user: session.user,
        profile: newProfile as Profile,
        session,
      });
    }

    return NextResponse.json({
      user: session.user,
      profile: profile as Profile,
      session,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

