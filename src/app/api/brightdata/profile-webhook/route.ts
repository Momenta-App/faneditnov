/**
 * BrightData webhook handler for profile verification
 * Receives profile data and checks for verification code in bio
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { finalizeOwnershipForSocialAccount } from '@/lib/raw-video-assets';
import { resolveOwnershipConflicts } from '@/lib/contest-ownership';
import { extractBioFromProfileData, verifyCodeInBio, normalizeProfileUrl } from '@/lib/social-account-helpers';

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

    // BrightData webhook formats:
    // 1. Notification: {snapshot_id, status: "ready"} 
    // 2. Data payload: [{...profileData, input: {snapshot_id, url}}] or [{snapshot_id, data: {...}}]
    // 3. Direct data: {snapshot_id, data: {...}} or {...profileData, snapshot_id}
    
    let snapshot_id: string | undefined;
    let status: string | undefined;
    let profileData: any = undefined;

    // First, check request headers for snapshot_id (BrightData sometimes sends it there)
    snapshot_id = request.headers.get('x-snapshot-id') || 
                  request.headers.get('snapshot-id') || 
                  request.headers.get('x-brightdata-snapshot-id') ||
                  undefined;
    
    if (snapshot_id) {
      console.log('[Profile Webhook] Found snapshot_id in headers:', snapshot_id);
    }

    // Check if this is data payload (array of records)
    if (Array.isArray(payload) && payload.length > 0) {
      const firstItem = payload[0];
      
      // Extract snapshot_id from all possible locations in the data payload
      // BrightData often includes it in input field: input: {snapshot_id: "...", url: "..."}
      snapshot_id = snapshot_id || 
        firstItem.snapshot_id || 
        firstItem.id || 
        firstItem.snapshotId || 
        firstItem.collection_id ||
        firstItem.input?.snapshot_id ||
        firstItem.input?.id ||
        firstItem.metadata?.snapshot_id ||
        firstItem._snapshot_id;
      
      // Check if it's a wrapper with data field
      if (firstItem.data || firstItem.result || firstItem.results) {
        const data = firstItem.data || firstItem.result || firstItem.results;
        profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
        status = firstItem.status || firstItem.state || 'completed';
      } else {
        // Direct profile data - check input field for snapshot_id
        profileData = firstItem;
        status = 'completed';
        
        // If still no snapshot_id, check input field (BrightData includes original request here)
        if (!snapshot_id && firstItem.input) {
          snapshot_id = firstItem.input.snapshot_id || firstItem.input.id;
        }
      }
    } else if (payload && typeof payload === 'object') {
      // Object payload - extract snapshot_id from all possible locations
      snapshot_id = snapshot_id ||
        payload.snapshot_id || 
        payload.id || 
        payload.snapshotId || 
        payload.snapshot || 
        payload.collection_id ||
        payload.input?.snapshot_id ||
        payload.input?.id ||
        payload.metadata?.snapshot_id;
      
      // Check if it has data field
      if (payload.data || payload.result || payload.results) {
        const data = payload.data || payload.result || payload.results;
        profileData = Array.isArray(data) && data.length > 0 ? data[0] : data;
        status = payload.status || payload.state || 'completed';
      } else {
        // Might be direct profile data - check if it looks like profile data
        // Instagram may have nested account object, TikTok/YouTube have top-level fields
        const looksLikeProfileData = 
          payload.url || 
          payload.handle || 
          payload.Description || 
          payload.description || 
          payload.name ||
          payload.biography || // TikTok/Instagram top-level
          payload.account || // Instagram nested structure
          payload.nickname || // TikTok
          payload.followers !== undefined; // Social media indicator
        
        if (looksLikeProfileData) {
          profileData = payload;
          status = 'completed';
          
          // Check input field for snapshot_id
          if (!snapshot_id && payload.input) {
            snapshot_id = payload.input.snapshot_id || payload.input.id;
          }
        }
      }
    }
    
    // Final check: if we have profile data with input field, extract snapshot_id from there
    if (!snapshot_id && profileData?.input) {
      snapshot_id = profileData.input.snapshot_id || profileData.input.id;
      console.log('[Profile Webhook] Found snapshot_id in profileData.input:', snapshot_id);
    }

    console.log('[Profile Webhook] Extracted values:', { 
      snapshot_id, 
      status, 
      hasData: !!profileData,
      dataKeys: profileData ? Object.keys(profileData).slice(0, 10) : [],
      payloadKeys: payload ? Object.keys(payload).slice(0, 10) : []
    });

    // snapshot_id is REQUIRED - this is the primary way to match accounts
    if (!snapshot_id) {
      console.error('[Profile Webhook] Missing snapshot_id in payload');
      console.error('[Profile Webhook] Full payload:', JSON.stringify(payload, null, 2).substring(0, 1000));
      return NextResponse.json({ 
        error: 'Missing snapshot_id',
        message: 'snapshot_id is required to match accounts. Check BrightData webhook configuration.',
        received_payload: payload 
      }, { status: 400 });
    }

    // Find account by snapshot_id (PRIMARY METHOD - this should always work)
    let { data: account, error: accountError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('snapshot_id', snapshot_id)
      .maybeSingle();

    console.log('[Profile Webhook] Account lookup by snapshot_id:', {
      found: !!account,
      error: accountError?.message,
      accountId: account?.id,
      snapshot_id,
      searchedSnapshotId: snapshot_id
    });

    // If account not found by snapshot_id, this is an error - snapshot_id should always match
    // Only try URL fallback as last resort for debugging
    if (!account) {
      console.error('[Profile Webhook] Account not found by snapshot_id - this should not happen!');
      console.error('[Profile Webhook] Snapshot ID searched:', snapshot_id);
      console.error('[Profile Webhook] Checking if snapshot_id exists in database...');
      
      // Check if any account has this snapshot_id (for debugging)
      const { data: allAccounts } = await supabaseAdmin
        .from('social_accounts')
        .select('id, snapshot_id, profile_url, platform, webhook_status')
        .limit(10);
      
      console.error('[Profile Webhook] Sample accounts in database:', allAccounts?.map(a => ({
        id: a.id,
        snapshot_id: a.snapshot_id,
        profile_url: a.profile_url,
        webhook_status: a.webhook_status
      })));
      
      // Only try URL fallback if we have profile data (shouldn't be needed)
      if (profileData) {
        console.log('[Profile Webhook] Attempting URL fallback (this should not be necessary)...');
        const profileUrl = profileData.url || profileData.profile_url || profileData.account_url;
        
        if (profileUrl) {
          // Simple URL matching - just try normalized version
          const normalizedUrl = normalizeProfileUrl(profileUrl.replace('/about', '').replace(/\/$/, ''));
          
          ({ data: account, error: accountError } = await supabaseAdmin
            .from('social_accounts')
            .select('*')
            .eq('profile_url', normalizedUrl)
            .or('webhook_status.eq.PENDING,webhook_status.is.null')
            .maybeSingle());
          
          if (account) {
            console.log('[Profile Webhook] Found account by URL fallback - updating snapshot_id');
            // Update with snapshot_id for future lookups
            await supabaseAdmin
              .from('social_accounts')
              .update({ snapshot_id })
              .eq('id', account.id);
          }
        }
      }
      
      // If still not found, return error
      if (!account) {
        console.error('[Profile Webhook] Account not found - snapshot_id mismatch or account not created properly');
        return NextResponse.json({ 
          error: 'Account not found',
          snapshot_id,
          message: 'Could not find account with matching snapshot_id. Verify that the account was created and snapshot_id was saved correctly.',
        }, { status: 404 });
      }
    }

    if (accountError || !account) {
      // Log detailed debugging information
      const debugInfo = {
        snapshot_id,
        hasProfileData: !!profileData,
        profileUrl: profileData?.url || profileData?.profile_url || profileData?.account_url,
        accountError: accountError?.message,
        accountErrorCode: accountError?.code,
        payloadType: Array.isArray(payload) ? 'array' : typeof payload,
        payloadKeys: payload ? Object.keys(payload).slice(0, 10) : [],
      };
      
      console.error('[Profile Webhook] Account not found - Debug info:', debugInfo);
      
      // If we have profile data but couldn't find account, log more details
      if (profileData) {
        console.error('[Profile Webhook] Profile data details:', {
          url: profileData.url || profileData.profile_url || profileData.account_url,
          channel_name: profileData.channel_name,
          channel_id: profileData.channel_id,
          account_id: profileData.account_id,
          username: profileData.username,
          platform: profileData.platform || 'unknown',
        });
        
        // Try to query database to see what accounts exist with similar URLs
        const testUrl = profileData.url || profileData.profile_url || profileData.account_url;
        if (testUrl) {
          const { data: similarAccounts } = await supabaseAdmin
            .from('social_accounts')
            .select('id, profile_url, platform, webhook_status, verification_status, snapshot_id')
            .ilike('profile_url', `%${testUrl.split('/').pop()}%`)
            .limit(5);
          
          console.error('[Profile Webhook] Similar accounts found in database:', similarAccounts);
        }
      }
      
      // Return 404 but with detailed error for debugging
      return NextResponse.json({ 
        error: 'Account not found',
        snapshot_id,
        message: 'Could not find account by snapshot_id or URL. Check server logs for details.',
        debug: debugInfo,
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
    
    // Instagram-specific logging
    if (account.platform === 'instagram') {
      console.log('[Profile Webhook] Instagram data structure check:');
      console.log('[Profile Webhook]   Top-level biography:', profileData.biography ? 'EXISTS' : 'MISSING');
      console.log('[Profile Webhook]   Account object:', profileData.account ? 'EXISTS' : 'MISSING');
      if (profileData.account) {
        console.log('[Profile Webhook]   Account.biography:', profileData.account.biography ? 'EXISTS' : 'MISSING');
        console.log('[Profile Webhook]   Account keys:', Object.keys(profileData.account).slice(0, 10));
      }
    }

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

    console.log('[Profile Webhook] Updating account with data:', {
      accountId: account.id,
      hasProfileData: !!updateData.profile_data,
      profileDataKeys: updateData.profile_data ? Object.keys(updateData.profile_data).slice(0, 10) : [],
      verificationStatus: updateData.verification_status,
      webhookStatus: updateData.webhook_status,
    });

    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('social_accounts')
      .update(updateData)
      .eq('id', account.id)
      .select('id, verification_code, verification_status, webhook_status, profile_data')
      .single();

    if (updateError) {
      console.error('[Profile Webhook] Error updating account:', {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        accountId: account.id,
      });
      return NextResponse.json(
        { error: 'Failed to update account', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Profile Webhook] Account updated successfully:', {
      accountId: account.id,
      verified: codeFound,
      verificationStatus: updateData.verification_status,
      hasProfileData: !!updatedAccount?.profile_data,
      profileDataKeys: updatedAccount?.profile_data ? Object.keys(updatedAccount.profile_data).slice(0, 10) : [],
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


