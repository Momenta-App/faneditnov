/**
 * BrightData webhook handler for profile verification
 * Receives profile data and checks for verification code in bio
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { finalizeOwnershipForSocialAccount } from '@/lib/raw-video-assets';
import { resolveOwnershipConflicts } from '@/lib/contest-ownership';
import { extractBioFromProfileData, verifyCodeInBio } from '@/lib/social-account-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 minutes to allow for BrightData polling

/**
 * POST /api/brightdata/profile-webhook
 * Handle BrightData webhook for profile verification
 */
export async function POST(request: NextRequest) {
  console.log('[Profile Webhook] ========== WEBHOOK CALLED ==========');
  console.log('[Profile Webhook] Request method:', request.method);
  console.log('[Profile Webhook] Request URL:', request.url);
  
  try {
    const rawBody = await request.text();
    console.log('[Profile Webhook] Raw body length:', rawBody.length);
    console.log('[Profile Webhook] Raw body preview:', rawBody.substring(0, 500));
    
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[Profile Webhook] JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[Profile Webhook] Received payload:', {
      isArray: Array.isArray(payload),
      payloadKeys: Array.isArray(payload) ? `Array with ${payload.length} items` : Object.keys(payload).slice(0, 10),
    });

    // BrightData can send webhooks in two formats:
    // 1. Status notification with snapshot_id pointing to snapshot
    // 2. Direct data payload (with uncompressed_webhook=true)
    
    let snapshot_id: string | undefined;
    let status: string | undefined;
    let data: any = undefined;
    let profileData: any = undefined;

    // Check if this is data payload (array of records)
    if (Array.isArray(payload) && payload.length > 0) {
      const firstItem = payload[0];
      // Check if it's a webhook payload with snapshot_id
      if (firstItem.snapshot_id || firstItem.id || firstItem.snapshotId) {
        snapshot_id = firstItem.snapshot_id || firstItem.id || firstItem.snapshotId;
        status = firstItem.status || firstItem.state || 'completed';
        data = firstItem.data || firstItem.result || firstItem.results;
        profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
      } else {
        // Direct profile data array
        profileData = firstItem;
        status = 'completed';
        // Try to extract snapshot_id from the record
        snapshot_id = firstItem.snapshot_id || firstItem.id;
      }
    } else if (payload && typeof payload === 'object') {
      // Standard webhook format
      snapshot_id = payload.snapshot_id || payload.id || payload.snapshotId || payload.snapshot;
      status = payload.status || payload.state || 'completed';
      data = payload.data || payload.result || payload.results;
      profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
    }

    console.log('[Profile Webhook] Extracted values:', { 
      snapshot_id, 
      status, 
      hasData: !!profileData,
      dataKeys: profileData ? Object.keys(profileData).slice(0, 10) : []
    });

    if (!snapshot_id) {
      console.error('[Profile Webhook] Missing snapshot_id in payload');
      return NextResponse.json({ error: 'Missing snapshot_id' }, { status: 400 });
    }

    // Find account by snapshot_id first (most reliable)
    let { data: account, error: accountError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('snapshot_id', snapshot_id)
      .maybeSingle();

    console.log('[Profile Webhook] Account lookup by snapshot_id:', {
      found: !!account,
      error: accountError?.message,
      accountId: account?.id
    });

    // If not found by snapshot_id, try to find by URL if we have profile data
    if (!account && profileData) {
      const profileUrl = profileData.url || profileData.profile_url || profileData.account_url;
      if (profileUrl) {
        let normalizedUrl = profileUrl;
        if (profileUrl.includes('/about')) {
          normalizedUrl = profileUrl.replace('/about', '').replace(/\/$/, '');
        }
        
        ({ data: account, error: accountError } = await supabaseAdmin
          .from('social_accounts')
          .select('*')
          .or(`profile_url.eq.${normalizedUrl},profile_url.eq.${profileUrl}`)
          .eq('webhook_status', 'PENDING')
          .maybeSingle());

        console.log('[Profile Webhook] Account lookup by URL:', {
          found: !!account,
          error: accountError?.message,
          accountId: account?.id,
          url: profileUrl
        });

        // If found by URL, update snapshot_id
        if (account) {
          await supabaseAdmin
            .from('social_accounts')
            .update({ snapshot_id })
            .eq('id', account.id);
        }
      }
    }

    if (accountError || !account) {
      console.error('[Profile Webhook] Account not found for snapshot_id:', snapshot_id);
      return NextResponse.json({ 
        error: 'Account not found',
        snapshot_id,
        received_payload: payload 
      }, { status: 404 });
    }

    // If this is a status notification without data, download it from BrightData
    if (status === 'completed' && !profileData) {
      console.log('[Profile Webhook] Status notification without data, downloading from BrightData API...');
      
      const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
      if (!apiKey) {
        console.error('[Profile Webhook] BRIGHT_DATA_API_KEY not configured');
        return NextResponse.json({ error: 'BrightData API key not configured' }, { status: 500 });
      }

      // Wait for snapshot to be ready
      // BrightData can take 5+ minutes, so we poll for up to 10 minutes
      // Poll every 10 seconds, up to 60 attempts = 10 minutes total
      let snapshotReady = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 10 seconds = 10 minutes
      const pollInterval = 10000; // 10 seconds between polls

      console.log(`[Profile Webhook] Starting to poll for snapshot ${snapshot_id}, will check up to ${maxAttempts} times (${maxAttempts * pollInterval / 1000 / 60} minutes)`);

      while (!snapshotReady && attempts < maxAttempts) {
        try {
          const snapshotResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            }
          );

          if (!snapshotResponse.ok) {
            console.error(`[Profile Webhook] Snapshot API returned ${snapshotResponse.status}`);
            if (attempts < maxAttempts) {
              attempts++;
              const waitTime = attempts < 5 ? 5000 : pollInterval; // Faster polling for first few attempts
              console.log(`[Profile Webhook] API error, waiting ${waitTime/1000}s before retry (attempt ${attempts}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            break;
          }

          const snapshotData = await snapshotResponse.json();
          const currentStatus = snapshotData.status || snapshotData.state;
          console.log(`[Profile Webhook] Snapshot status check ${attempts + 1}/${maxAttempts}: ${currentStatus}`);

          if (currentStatus === 'ready' || currentStatus === 'completed') {
            snapshotReady = true;
            console.log(`[Profile Webhook] Snapshot is ready after ${attempts + 1} attempts (${(attempts + 1) * pollInterval / 1000}s)`);
          } else if (currentStatus === 'failed' || currentStatus === 'error') {
            console.error(`[Profile Webhook] Snapshot failed with status: ${currentStatus}`);
            // Update account with failure
            await supabaseAdmin
              .from('social_accounts')
              .update({
                webhook_status: 'FAILED',
                verification_status: 'FAILED',
                verification_attempts: (account.verification_attempts || 0) + 1,
                last_verification_attempt_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', account.id);
            
            return NextResponse.json({ 
              success: true, 
              verified: false,
              status: 'failed',
              message: `Snapshot failed: ${currentStatus}`
            });
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              const waitTime = attempts < 5 ? 5000 : pollInterval; // Faster polling for first few attempts
              const elapsedMinutes = ((attempts + 1) * waitTime) / 1000 / 60;
              console.log(`[Profile Webhook] Snapshot not ready (${currentStatus}), waiting ${waitTime/1000}s (attempt ${attempts + 1}/${maxAttempts}, ${elapsedMinutes.toFixed(1)}min elapsed)`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        } catch (error) {
          console.error('[Profile Webhook] Error checking snapshot status:', error);
          attempts++;
          if (attempts < maxAttempts) {
            const waitTime = attempts < 5 ? 5000 : pollInterval;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (!snapshotReady) {
        console.warn(`[Profile Webhook] Snapshot not ready after ${maxAttempts} attempts (${maxAttempts * pollInterval / 1000 / 60} minutes), attempting to proceed anyway...`);
      }
      
      // Download snapshot data from BrightData
      console.log('[Profile Webhook] Downloading snapshot data from BrightData API...');
      const dataResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}/data`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error('[Profile Webhook] Data download failed:', dataResponse.status, errorText);
        return NextResponse.json(
          { 
            error: 'Failed to download snapshot data',
            details: `API returned ${dataResponse.status}: ${errorText}`
          },
          { status: 500 }
        );
      }

      const downloadedPayload = await dataResponse.json();
      console.log('[Profile Webhook] Data downloaded, processing...', { 
        recordCount: Array.isArray(downloadedPayload) ? downloadedPayload.length : 'unknown' 
      });
      
      profileData = Array.isArray(downloadedPayload) && downloadedPayload.length > 0 
        ? downloadedPayload[0] 
        : downloadedPayload;
    }

    // Handle failed status
    if (status === 'failed' || status === 'error') {
      console.log('[Profile Webhook] Snapshot failed, updating account status');
      await supabaseAdmin
        .from('social_accounts')
        .update({
          webhook_status: 'FAILED',
          verification_status: 'FAILED',
          verification_attempts: (account.verification_attempts || 0) + 1,
          last_verification_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);
      
      return NextResponse.json({ 
        success: true, 
        verified: false,
        status: 'failed'
      });
    }

    if (!profileData) {
      console.error('[Profile Webhook] No profile data available');
      return NextResponse.json({ error: 'No profile data available' }, { status: 400 });
    }

    console.log('[Profile Webhook] Processing profile data for account:', account.id);
    console.log('[Profile Webhook] Profile data keys:', Object.keys(profileData).slice(0, 20));

    // Ensure profileData is a plain object for JSONB storage
    const profileDataForDb = JSON.parse(JSON.stringify(profileData));

    // Extract bio text from profile data
    const bioText = extractBioFromProfileData(profileData, account.platform);
    console.log('[Profile Webhook] Extracted bio text:', bioText);
    console.log('[Profile Webhook] Looking for verification code:', account.verification_code);

    // Check for verification code in bio
    const codeFound = verifyCodeInBio(bioText, account.verification_code);
    console.log('[Profile Webhook] Code found in bio:', codeFound);

    // Update account
    const updateData: any = {
      profile_data: profileDataForDb,
      webhook_status: 'COMPLETED',
      last_verification_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (codeFound) {
      updateData.verification_status = 'VERIFIED';
      updateData.verification_attempts = 0;
    } else {
      updateData.verification_status = 'FAILED';
      updateData.verification_attempts = (account.verification_attempts || 0) + 1;
    }

    const { error: updateError } = await supabaseAdmin
      .from('social_accounts')
      .update(updateData)
      .eq('id', account.id);

    if (updateError) {
      console.error('[Profile Webhook] Error updating account:', updateError);
      return NextResponse.json(
        { error: 'Failed to update account', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Profile Webhook] Account updated successfully:', {
      accountId: account.id,
      verified: codeFound,
      verificationStatus: updateData.verification_status
    });

    if (codeFound) {
      // Finalize ownership for raw video assets
      await finalizeOwnershipForSocialAccount(account.id);

      // Resolve ownership conflicts for contest submissions
      // Find all contest submissions with pending/contested ownership for videos from this account
      const { data: pendingSubmissions } = await supabaseAdmin
        .from('contest_submissions')
        .select('original_video_url, platform')
        .eq('social_account_id', account.id)
        .in('mp4_ownership_status', ['pending', 'contested'])
        .limit(100); // Limit to prevent timeout

      if (pendingSubmissions && pendingSubmissions.length > 0) {
        // Get unique video URLs
        const uniqueVideoUrls = [...new Set(pendingSubmissions.map(s => s.original_video_url))];
        
        console.log('[Profile Webhook] Resolving ownership conflicts for verified account:', {
          accountId: account.id,
          userId: account.user_id,
          videoCount: uniqueVideoUrls.length,
        });

        // Resolve conflicts for each unique video URL
        for (const videoUrl of uniqueVideoUrls) {
          try {
            await resolveOwnershipConflicts(
              videoUrl,
              account.id,
              account.user_id
            );
          } catch (err) {
            console.error('[Profile Webhook] Error resolving ownership conflict:', {
              videoUrl,
              accountId: account.id,
              error: err instanceof Error ? err.message : String(err),
            });
            // Continue with other videos even if one fails
          }
        }
      }
    }

    return NextResponse.json({ success: true, verified: codeFound });
  } catch (error) {
    console.error('[Profile Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


