import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';
import { checkVideoSubmissionQuota, recordVideoSubmission } from '@/lib/quota-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Server-side environment variables
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY;
const BRIGHT_DATA_CUSTOMER_ID = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID = process.env.BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID;
const BRIGHT_DATA_MOCK_MODE = process.env.BRIGHT_DATA_MOCK_MODE;

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const body = await request.json();
    const { urls, skip_validation = false } = body;

    // Validate input
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and cannot be empty', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Admin-only: Validate skip_validation permission
    if (skip_validation && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can bypass validation', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Check quota for each URL (one submission per URL)
    const quotaStatus = await checkVideoSubmissionQuota(user.id, user.role);
    
    console.log('Quota check result:', {
      userId: user.id,
      role: user.role,
      allowed: quotaStatus.allowed,
      limit: quotaStatus.limit,
      current: quotaStatus.current,
      remaining: quotaStatus.remaining,
    });
    
    if (!quotaStatus.allowed) {
      return NextResponse.json(
        {
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: {
            limit: quotaStatus.limit,
            current: quotaStatus.current,
            remaining: quotaStatus.remaining,
            resetAt: quotaStatus.resetAt.toISOString(),
          },
        },
        { status: 429 }
      );
    }

    // Validate TikTok URLs
    const invalidUrls = urls.filter(url => !url.includes('tiktok.com'));
    if (invalidUrls.length > 0) {
      return NextResponse.json(
        { error: 'All URLs must be valid TikTok URLs', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    console.log('BrightData trigger received:', { urlCount: urls.length, skip_validation });

    // Store metadata for webhook (with placeholder snapshot_id)
    const placeholderSnapshotId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const { error: metadataError } = await supabaseAdmin
      .from('submission_metadata')
      .insert({
        snapshot_id: placeholderSnapshotId,
        video_urls: urls, // Store URLs for lookup since snapshot_id may change
        skip_validation,
        submitted_by: user.id
      });

    if (metadataError) {
      console.error('Failed to store submission metadata:', metadataError);
      // Non-fatal, continue anyway
    }

    // Mock mode
    if (BRIGHT_DATA_MOCK_MODE === 'true') {
      const mockSnapshotId = `mock_snapshot_${Date.now()}`;
      console.log('Mock mode: returning mock snapshot ID:', mockSnapshotId);
      
      // Update metadata with real snapshot_id
      await supabaseAdmin
        .from('submission_metadata')
        .update({ snapshot_id: mockSnapshotId })
        .eq('snapshot_id', placeholderSnapshotId);
      
      return NextResponse.json({
        snapshot_id: mockSnapshotId,
        status: 'queued',
        mock: true,
        urls: urls
      });
    }

    // Real BrightData API call
    const brightDataPayload = urls.map(url => ({
      url,
      country: ''
    }));

    // Build the trigger URL with webhook parameters
    // Use dynamic app URL from environment to support dev/prod environments
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > dev URL fallback
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      // If VERCEL_URL is set, use it (Vercel automatically sets this)
      if (process.env.VERCEL_URL) {
        // VERCEL_URL doesn't include protocol, so add https://
        appUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        // For local/dev environments, default to dev URL
        appUrl = 'https://fanedit-dev.vercel.app';
      }
    }
    
    // CRITICAL: Ensure production uses www.fanedit.com (not fanedit.com)
    // fanedit.com redirects to www.fanedit.com, but webhooks don't follow redirects properly
    // This ensures BrightData can POST directly to the correct URL
    if (appUrl === 'https://fanedit.com' || appUrl === 'https://fanedit.com/') {
      appUrl = 'https://www.fanedit.com';
      console.log('🔍 DEBUG - Fixed production URL to use www subdomain:', appUrl);
    }
    
    // Remove trailing slash to avoid double slashes in webhook URL
    appUrl = appUrl.replace(/\/+$/, '');
    
    const webhookUrl = encodeURIComponent(`${appUrl}/api/brightdata/webhook`);
    const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID}&endpoint=${webhookUrl}&notify=${webhookUrl}&format=json&uncompressed_webhook=true&include_errors=true`;
    
    console.log('🔍 DEBUG - Environment check:', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      selectedAppUrl: appUrl,
    });
    console.log('🔍 DEBUG - Webhook URL being sent to BrightData:', `${appUrl}/api/brightdata/webhook`);
    console.log('🔍 DEBUG - Bulk upload:', { urlCount: urls.length, skipValidation: skip_validation });
    console.log('🔍 DEBUG - Full trigger URL (truncated):', triggerUrl.substring(0, 200) + '...');

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHT_DATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brightDataPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BrightData API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to trigger BrightData dataset',
          details: `API returned ${response.status}: ${errorText}`
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log('BrightData trigger successful:', result);

    // Update metadata with actual snapshot_id from BrightData
    const actualSnapshotId = result.snapshot_id || result.snapshotId;
    if (actualSnapshotId && supabaseAdmin) {
      console.log('🔄 UPDATING METADATA - Replacing placeholder with actual snapshot_id:', {
        placeholder: placeholderSnapshotId,
        actual: actualSnapshotId,
        urlCount: urls.length
      });
      
      const { error: updateError } = await supabaseAdmin
        .from('submission_metadata')
        .update({ snapshot_id: actualSnapshotId })
        .eq('snapshot_id', placeholderSnapshotId);
      
      if (updateError) {
        console.error('❌ FAILED TO UPDATE METADATA:', updateError);
        // This is critical - webhook won't be able to find the metadata
        console.error('⚠️ WARNING: Webhook may fail to process this submission');
      } else {
        console.log('✅ METADATA UPDATED SUCCESSFULLY');
      }
    } else {
      console.warn('⚠️ WARNING: No snapshot_id returned from BrightData, webhook lookup may fail');
      console.warn('⚠️ Result from BrightData:', JSON.stringify(result, null, 2));
    }

    // Record the submission (increment quota counter)
    await recordVideoSubmission(user.id);

    return NextResponse.json(result);

  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error);
    }

    console.error('Trigger API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'BrightData Trigger API',
    mockMode: BRIGHT_DATA_MOCK_MODE,
    endpoints: {
      'POST /api/brightdata/trigger': 'Trigger BrightData dataset with TikTok URLs',
    },
  });
}
