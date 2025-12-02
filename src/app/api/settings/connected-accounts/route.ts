/**
 * User API routes for connected social accounts
 * GET: List user's connected accounts
 * POST: Add connected account (generate verification code)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { associateAccountWithPendingAssets } from '@/lib/raw-video-assets';
import { generateVerificationCode } from '@/lib/social-account-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/connected-accounts
 * Get user's connected social accounts
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { data: accounts, error } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data: accounts || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching connected accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/connected-accounts
 * Add a new connected account
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { platform, profile_url, username } = body;

    if (!platform || !profile_url) {
      return NextResponse.json(
        { error: 'platform and profile_url are required' },
        { status: 400 }
      );
    }

    if (!['tiktok', 'instagram', 'youtube'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be tiktok, instagram, or youtube' },
        { status: 400 }
      );
    }

    // Generate verification code (6 alphanumeric characters)
    const verificationCode = generateVerificationCode();

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('profile_url', profile_url)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This account is already connected' },
        { status: 400 }
      );
    }

    // Create account
    const { data: account, error: createError } = await supabaseAdmin
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform,
        profile_url,
        username: username || null,
        verification_code: verificationCode,
        verification_status: 'PENDING',
      })
      .select()
      .single();

    if (createError) throw createError;

    await associateAccountWithPendingAssets(account.id);

    return NextResponse.json({
      data: account,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating connected account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

