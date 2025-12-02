/**
 * User API route for checking verification status
 * GET: Poll verification status and check BrightData directly if webhook hasn't arrived
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';
import { extractBioFromProfileData, verifyCodeInBio } from '@/lib/social-account-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/connected-accounts/verify/status
 * Get verification status for an account
 * If webhook hasn't arrived, poll BrightData directly
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

    // If webhook hasn't completed and we have a snapshot_id, check BrightData directly
    if (account.webhook_status === 'PENDING' && account.snapshot_id && account.verification_status === 'PENDING') {
      const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
      if (apiKey) {
        try {
          console.log('[Status Check] Polling BrightData snapshot:', account.snapshot_id);
          
          // Check snapshot status
          const snapshotResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${account.snapshot_id}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            }
          );

          if (snapshotResponse.ok) {
            const snapshotData = await snapshotResponse.json();
            const status = snapshotData.status?.toLowerCase() || snapshotData.state?.toLowerCase();

            console.log('[Status Check] Snapshot status:', status);

            // Check if data is directly in the status response (some BrightData APIs return data directly)
            // Instagram may have nested account object, TikTok/YouTube have top-level fields
            let profileData: any = null;
            const hasProfileData = 
              snapshotData.account_id || 
              snapshotData.biography || 
              snapshotData.nickname ||
              snapshotData.account || // Instagram nested structure
              snapshotData.url || // YouTube
              snapshotData.handle || // YouTube/TikTok
              snapshotData.Description || // YouTube
              snapshotData.description || // YouTube
              snapshotData.followers !== undefined; // Social media indicator
            
            if (hasProfileData) {
              console.log('[Status Check] Data found directly in status response');
              profileData = snapshotData;
            } else if (snapshotData.data) {
              // Check if data is in a data field
              const data = Array.isArray(snapshotData.data) && snapshotData.data.length > 0 
                ? snapshotData.data[0] 
                : snapshotData.data;
              const hasDataProfileData = 
                data && (
                  data.account_id || 
                  data.biography || 
                  data.nickname ||
                  data.account || // Instagram nested structure
                  data.url ||
                  data.handle ||
                  data.Description ||
                  data.description ||
                  data.followers !== undefined
                );
              if (hasDataProfileData) {
                console.log('[Status Check] Data found in status response data field');
                profileData = data;
              }
            }

            // If snapshot is ready/completed, download the data (if not already found above)
            if (!profileData && (status === 'ready' || status === 'completed' || status === 'done' || status === 'success')) {
              console.log('[Status Check] Snapshot ready, downloading data...');
              
              const dataResponse = await fetch(
                `https://api.brightdata.com/datasets/v3/snapshot/${account.snapshot_id}/data`,
                {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                  },
                }
              );

              if (dataResponse.ok) {
                const dataPayload = await dataResponse.json();
                profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
                  ? dataPayload[0] 
                  : dataPayload;
              } else {
                console.log('[Status Check] Data not ready yet, status:', dataResponse.status);
              }
            }

            if (profileData) {
              console.log('[Status Check] Profile data received, processing verification...');
                  
              // Extract bio and verify code
              const bioText = extractBioFromProfileData(profileData, account.platform);
              const codeFound = verifyCodeInBio(bioText, account.verification_code);

              console.log('[Status Check] Bio text:', bioText);
              console.log('[Status Check] Verification code:', account.verification_code);
              console.log('[Status Check] Code found:', codeFound);

              // Update account with results
              const updateData: any = {
                profile_data: profileData,
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

              const { data: updatedAccount, error: updateError } = await supabaseAdmin
                .from('social_accounts')
                .update(updateData)
                .eq('id', account.id)
                .select('id, verification_code, verification_status, webhook_status, profile_data')
                .single();

              if (updateError) {
                console.error('[Status Check] Error updating account:', {
                  error: updateError.message,
                  code: updateError.code,
                  details: updateError.details,
                  accountId: account.id,
                });
                // Continue to return current status if update fails
              } else {
                console.log('[Status Check] Account updated successfully:', {
                  accountId: updatedAccount?.id,
                  verification_status: updateData.verification_status,
                  codeFound,
                  hasProfileData: !!updatedAccount?.profile_data,
                });
              }

              // Return updated status
              return NextResponse.json({
                data: {
                  verification_status: updateData.verification_status,
                  webhook_status: 'COMPLETED',
                  verification_code: account.verification_code,
                  last_verification_attempt_at: updateData.last_verification_attempt_at,
                  snapshot_id: account.snapshot_id,
                },
              });
            } else if (status === 'failed' || status === 'error') {
              // Snapshot failed
              const { error: updateError } = await supabaseAdmin
                .from('social_accounts')
                .update({
                  webhook_status: 'FAILED',
                  verification_status: 'FAILED',
                  verification_attempts: (account.verification_attempts || 0) + 1,
                  last_verification_attempt_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', account.id);

              if (updateError) {
                console.error('[Status Check] Error updating account on failure:', {
                  error: updateError.message,
                  code: updateError.code,
                  accountId: account.id,
                });
              }

              return NextResponse.json({
                data: {
                  verification_status: 'FAILED',
                  webhook_status: 'FAILED',
                  verification_code: account.verification_code,
                  last_verification_attempt_at: new Date().toISOString(),
                  snapshot_id: account.snapshot_id,
                },
              });
            } else {
              // Still processing
              console.log('[Status Check] Snapshot still processing, status:', status);
            }
          }
        } catch (error) {
          console.error('[Status Check] Error polling BrightData:', error);
          // Continue to return current status if polling fails
        }
      }
    }

    // Return current status
    return NextResponse.json({
      data: {
        verification_status: account.verification_status,
        webhook_status: account.webhook_status,
        verification_code: account.verification_code,
        last_verification_attempt_at: account.last_verification_attempt_at,
        snapshot_id: account.snapshot_id,
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

