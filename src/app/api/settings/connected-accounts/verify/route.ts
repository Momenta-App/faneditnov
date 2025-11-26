/**
 * User API route for verifying social accounts
 * POST: Trigger BrightData profile scrape and verify code in bio
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/settings/connected-accounts/verify
 * Trigger verification for a social account
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { account_id } = body;

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

    if (account.verification_status === 'VERIFIED') {
      return NextResponse.json({
        message: 'Account is already verified',
        account,
      });
    }

    // Trigger BrightData profile snapshot
    const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'BrightData API key not configured' },
        { status: 500 }
      );
    }

    // Get dataset ID for platform
    let datasetId: string | undefined;
    switch (account.platform) {
      case 'tiktok':
        datasetId = process.env.BRIGHT_DATA_TIKTOK_PROFILE_SCRAPER_ID;
        break;
      case 'instagram':
        datasetId = process.env.BRIGHT_DATA_INSTAGRAM_PROFILE_SCRAPER_ID;
        break;
      case 'youtube':
        datasetId = process.env.BRIGHT_DATA_YOUTUBE_PROFILE_SCRAPER_ID;
        break;
    }

    if (!datasetId) {
      return NextResponse.json(
        { error: `Profile scraper not configured for ${account.platform}` },
        { status: 500 }
      );
    }

    // Construct webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${appUrl}/api/brightdata/profile-webhook`;

    // Prepare profile URL (YouTube needs /about suffix)
    let profileUrl = account.profile_url;
    if (account.platform === 'youtube' && !profileUrl.includes('/about')) {
      profileUrl = profileUrl.endsWith('/') ? `${profileUrl}about` : `${profileUrl}/about`;
    }

    // Trigger BrightData collection
    const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&format=json&uncompressed_webhook=true&webhook_url=${encodeURIComponent(webhookUrl)}&include_errors=true`;

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url: profileUrl }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BrightData trigger failed: ${errorText}`);
    }

    const triggerData = await response.json();

    // Extract snapshot ID
    let snapshotId: string | undefined;
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      snapshotId = triggerData[0]?.snapshot_id || triggerData[0]?.id || triggerData[0]?.collection_id;
    } else if (triggerData && typeof triggerData === 'object') {
      snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
    }

    // Update account with snapshot ID
    await supabaseAdmin
      .from('social_accounts')
      .update({
        snapshot_id: snapshotId || null,
        webhook_status: 'PENDING',
        last_verification_attempt_at: new Date().toISOString(),
      })
      .eq('id', account_id);

    return NextResponse.json({
      success: true,
      message: 'Verification initiated. Please add the verification code to your bio and wait for confirmation.',
      verification_code: account.verification_code,
      snapshot_id: snapshotId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error verifying account:', error);
    return NextResponse.json(
      { error: 'Failed to verify account' },
      { status: 500 }
    );
  }
}

