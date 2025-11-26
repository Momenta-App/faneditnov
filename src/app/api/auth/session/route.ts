import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionFromRequest, getServerUserIdFromRequest } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Profile, UserRole } from '@/app/types/data';

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

    // Fetch profile using admin client to bypass RLS
    // This ensures we get the actual role from the database
    // Explicitly select all fields including role
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name, avatar_url, role, email_verified, created_at, updated_at')
      .eq('id', userId)
      .single();

    // Debug logging
    console.log('🔍 Session API - Profile fetch:', {
      userId,
      userEmail: session.user.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      profileEmail: profile?.email,
      error: error?.message,
      errorCode: error?.code,
    });
    
    // If there's an error, log more details
    if (error) {
      console.error('❌ Profile fetch error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    // If profile doesn't exist, create it (fallback)
    // BUT: Only create if there's a "not found" error (PGRST116)
    // Don't create if profile exists but query had a minor issue
    if (error && error.code === 'PGRST116') {
      // Profile truly doesn't exist - create it
      console.log('Profile not found (PGRST116), creating fallback profile for user:', userId);
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
    } else if (error) {
      // Other error - log it but don't create a new profile
      console.error('❌ Profile fetch error (not creating fallback):', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      // Return error instead of creating fallback
      return NextResponse.json({
        user: session.user,
        profile: null,
        session,
        error: 'Failed to fetch profile',
      });
    } else if (!profile) {
      // No error but no profile - this shouldn't happen, but handle it
      console.warn('⚠️ No error but profile is null/undefined');
      return NextResponse.json({
        user: session.user,
        profile: null,
        session,
      });
    }

    // If we get here, we have a valid profile from the database
    // Validate profile data before returning
    if (!profile.role) {
      console.error('❌ Profile missing role field!', profile);
    }
    
    // Log the profile being returned
    console.log('✅ Session API - Returning profile:', {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      display_name: profile.display_name,
      email_verified: profile.email_verified,
    });

    // Ensure we're returning the profile with the correct role
    // Double-check the role value before returning
    const roleValue = profile.role;
    console.log('🔍 Final role check before returning:', {
      rawRole: roleValue,
      roleType: typeof roleValue,
      isAdmin: roleValue === 'admin',
      roleLength: roleValue?.length,
    });
    
    if (roleValue !== 'admin' && roleValue !== 'standard' && roleValue !== 'creator' && roleValue !== 'brand') {
      console.error('❌ Invalid role value detected:', roleValue);
    }
    
    const profileData: Profile = {
      id: profile.id,
      email: profile.email,
      role: roleValue as UserRole, // Explicitly cast
      display_name: profile.display_name || undefined,
      avatar_url: profile.avatar_url || undefined,
      email_verified: profile.email_verified || false,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    // Log the exact data being returned
    console.log('📤 Returning profile data:', {
      id: profileData.id,
      email: profileData.email,
      role: profileData.role,
      roleType: typeof profileData.role,
    });

    const responseData = {
      user: session.user,
      profile: profileData,
      session,
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
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

