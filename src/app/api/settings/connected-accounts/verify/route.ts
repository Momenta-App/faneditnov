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

    // If retrying after a failure, reset status to PENDING
    // This allows users to retry verification if they clicked too early or if there was an error
    const isRetry = account.verification_status === 'FAILED';
    
    if (isRetry) {
      console.log('[Verify] Retrying verification after failure:', {
        account_id,
        previous_status: account.verification_status,
        previous_snapshot_id: account.snapshot_id,
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

    // Construct webhook URL - use same pattern as ingestion
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      if (process.env.VERCEL_URL) {
        appUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        appUrl = 'http://localhost:3000';
      }
    }

    // Ensure URL has protocol
    if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    // Legacy domain redirects
    if (appUrl === 'https://sportsclips.io' || appUrl === 'https://sportsclips.io/') {
      appUrl = 'https://www.sportsclips.io';
    }

    if (
      appUrl === 'https://fanedit.com' ||
      appUrl === 'https://fanedit.com/' ||
      appUrl === 'https://www.fanedit.com' ||
      appUrl === 'https://www.fanedit.com/'
    ) {
      appUrl = 'https://www.sportsclips.io';
    }

    // Remove trailing slashes
    appUrl = appUrl.replace(/\/+$/, '');

    const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/profile-webhook`);

    // Prepare profile URL (YouTube needs /about suffix)
    let profileUrl = account.profile_url;
    if (account.platform === 'youtube' && !profileUrl.includes('/about')) {
      profileUrl = profileUrl.endsWith('/') ? `${profileUrl}about` : `${profileUrl}/about`;
    }

    // Trigger BrightData collection - use endpoint and notify parameters like ingestion
    const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;

    console.log('[Verify] BrightData trigger details:', {
      platform: account.platform,
      datasetId,
      webhookUrl: `${appUrl}/api/brightdata/profile-webhook`,
      profileUrl,
    });

    const requestBody = [{ url: profileUrl }];

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Verify] BrightData trigger failed:', response.status, errorText);
      throw new Error(`BrightData trigger failed: ${response.status} ${errorText}`);
    }

    const triggerData = await response.json();
    console.log('[Verify] BrightData trigger response:', JSON.stringify(triggerData, null, 2));

    // Extract snapshot ID - use same pattern as ingestion
    let snapshotId: string | undefined;
    if (Array.isArray(triggerData) && triggerData.length > 0) {
      const firstItem = triggerData[0];
      snapshotId = firstItem?.snapshot_id || firstItem?.id || firstItem?.collection_id;
      console.log('[Verify] Extracted snapshot_id from array:', snapshotId);
    } else if (triggerData && typeof triggerData === 'object') {
      snapshotId = triggerData.snapshot_id || triggerData.id || triggerData.collection_id;
      console.log('[Verify] Extracted snapshot_id from object:', snapshotId);
    }

    if (!snapshotId) {
      console.warn('[Verify] No snapshot_id found in response:', triggerData);
      throw new Error('BrightData trigger succeeded but no snapshot_id returned');
    }

    // Update account with snapshot ID and reset status for retry
    console.log('[Verify] Updating account with snapshot_id:', {
      account_id,
      snapshot_id: snapshotId,
      is_retry: isRetry,
    });

    const updateData: any = {
      snapshot_id: snapshotId || null,
      webhook_status: 'PENDING',
      last_verification_attempt_at: new Date().toISOString(),
    };

    // If retrying after failure, reset verification status to PENDING
    // This ensures the UI shows the correct state and allows the webhook to update it
    if (isRetry) {
      updateData.verification_status = 'PENDING';
      // Clear old profile_data so we get fresh data
      updateData.profile_data = null;
      console.log('[Verify] Resetting verification status to PENDING for retry');
    }

    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('social_accounts')
      .update(updateData)
      .eq('id', account_id)
      .select('id, verification_code, snapshot_id, webhook_status, verification_status')
      .single();

    if (updateError) {
      console.error('[Verify] Error updating account with snapshot_id:', {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        account_id,
        snapshot_id: snapshotId,
      });
      // Don't throw - snapshot_id was received, so continue
    } else {
      console.log('[Verify] Account updated successfully:', {
        account_id: updatedAccount?.id,
        verification_code: updatedAccount?.verification_code,
        snapshot_id: updatedAccount?.snapshot_id,
        webhook_status: updatedAccount?.webhook_status,
      });
    }

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

