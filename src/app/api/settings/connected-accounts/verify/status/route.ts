/**
 * User API route for checking verification status
 * GET: Poll verification status
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/connected-accounts/verify/status
 * Get verification status for an account
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const account_id = searchParams.get('account_id');

    if (!account_id) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    // Get account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        verification_status: account.verification_status,
        webhook_status: account.webhook_status,
        verification_code: account.verification_code,
        last_verification_attempt_at: account.last_verification_attempt_at,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error checking verification status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

