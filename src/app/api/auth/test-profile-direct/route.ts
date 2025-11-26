import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/test-profile-direct
 * Direct test endpoint to query profile without session checks
 * This helps verify the database query is working correctly
 */
export async function GET(request: NextRequest) {
  try {
    const email = 'admin@momenta.app';
    
    // Get user ID from email
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      return NextResponse.json({
        error: 'Failed to fetch users',
        message: authError.message,
      }, { status: 500 });
    }

    const user = authUsers.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        email,
      }, { status: 404 });
    }

    // Query profile directly
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Also try by email
    const { data: profileByEmail, error: emailError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      profileById: profile || null,
      profileByIdError: profileError ? {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
      } : null,
      profileByEmail: profileByEmail || null,
      profileByEmailError: emailError ? {
        message: emailError.message,
        code: emailError.code,
      } : null,
      summary: {
        foundById: !!profile,
        foundByEmail: !!profileByEmail,
        roleById: profile?.role || null,
        roleByEmail: profileByEmail?.role || null,
      },
    });
  } catch (error) {
    console.error('Test profile direct error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

