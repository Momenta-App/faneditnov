/**
 * User API routes for connected social accounts
 * GET: List user's connected accounts
 * POST: Add connected account (generate verification code)
 * DELETE: Remove connected account
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { associateAccountWithPendingAssets } from '@/lib/raw-video-assets';
import { generateVerificationCode, normalizeProfileUrl } from '@/lib/social-account-helpers';

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

    // Normalize profile URL for comparison
    const normalizedUrl = normalizeProfileUrl(profile_url);

    // Check for duplicate - check ALL accounts (not just same user) with same profile_url and platform
    const { data: existingAccount } = await supabaseAdmin
      .from('social_accounts')
      .select('id, user_id, verification_status')
      .eq('platform', platform)
      .eq('profile_url', normalizedUrl)
      .maybeSingle();

    if (existingAccount) {
      // If it's the same user, return error about already connected
      if (existingAccount.user_id === user.id) {
        return NextResponse.json(
          { error: 'This account is already connected to your profile' },
          { status: 400 }
        );
      }
      // If it's a different user, return error about account already in use
      return NextResponse.json(
        { error: 'This social account is already connected to another user' },
        { status: 409 }
      );
    }

    // Check for duplicate username if provided
    if (username) {
      const { data: existingUsername } = await supabaseAdmin
        .from('social_accounts')
        .select('id, user_id, verification_status')
        .eq('platform', platform)
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (existingUsername) {
        // If it's verified by another user, reject
        if (existingUsername.user_id !== user.id && existingUsername.verification_status === 'VERIFIED') {
          return NextResponse.json(
            { error: 'This handle is already verified by another user' },
            { status: 409 }
          );
        }
      }
    }

    // All checks passed - now generate verification code
    const verificationCode = generateVerificationCode();

    // Create account
    console.log('[Create Account] Creating account:', {
      user_id: user.id,
      platform,
      profile_url: normalizedUrl,
      username: username || null,
      verification_code: verificationCode,
    });

    const { data: account, error: createError } = await supabaseAdmin
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform,
        profile_url: normalizedUrl,
        username: username || null,
        verification_code: verificationCode,
        verification_status: 'PENDING',
      })
      .select()
      .single();

    if (createError) {
      console.error('[Create Account] Error creating account:', {
        error: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint,
      });
      throw createError;
    }

    console.log('[Create Account] Account created successfully:', {
      account_id: account.id,
      verification_code: account.verification_code,
    });

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

/**
 * DELETE /api/settings/connected-accounts?id={accountId}
 * Delete a connected social account
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get account ID from query params
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('social_accounts')
      .select('id, user_id')
      .eq('id', accountId)
      .single();

    if (fetchError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete account
    const { error: deleteError } = await supabaseAdmin
      .from('social_accounts')
      .delete()
      .eq('id', accountId);

    if (deleteError) {
      console.error('Error deleting social account:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error deleting connected account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}

