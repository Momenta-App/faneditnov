/**
 * Background worker for processing pending account verifications
 * This endpoint can be called by a cron job or scheduled task
 * It checks all pending verifications and polls BrightData if needed
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractBioFromProfileData, verifyCodeInBio } from '@/lib/social-account-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/workers/verify-accounts
 * Process pending account verifications
 * Can be called by cron job or manually
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Verify Accounts Worker] Starting verification check...');

    // Get all accounts with pending verifications that have snapshot_id
    const { data: pendingAccounts, error: fetchError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .eq('webhook_status', 'PENDING')
      .eq('verification_status', 'PENDING')
      .not('snapshot_id', 'is', null)
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      console.error('[Verify Accounts Worker] Error fetching pending accounts:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending accounts' },
        { status: 500 }
      );
    }

    if (!pendingAccounts || pendingAccounts.length === 0) {
      console.log('[Verify Accounts Worker] No pending verifications found');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending verifications',
      });
    }

    console.log(`[Verify Accounts Worker] Found ${pendingAccounts.length} pending verifications`);

    const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY;
    if (!apiKey) {
      console.error('[Verify Accounts Worker] BRIGHT_DATA_API_KEY not configured');
      return NextResponse.json(
        { error: 'BrightData API key not configured' },
        { status: 500 }
      );
    }

    let processed = 0;
    let verified = 0;
    let failed = 0;
    let stillPending = 0;

    // Process each pending account
    for (const account of pendingAccounts) {
      try {
        console.log(`[Verify Accounts Worker] Processing account ${account.id}, snapshot: ${account.snapshot_id}`);

        // Check snapshot status
        const snapshotResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/snapshot/${account.snapshot_id}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );

        if (!snapshotResponse.ok) {
          console.log(`[Verify Accounts Worker] Snapshot ${account.snapshot_id} not ready yet (${snapshotResponse.status})`);
          stillPending++;
          continue;
        }

        const snapshotData = await snapshotResponse.json();
        const status = snapshotData.status?.toLowerCase() || snapshotData.state?.toLowerCase();

        console.log(`[Verify Accounts Worker] Snapshot ${account.snapshot_id} status: ${status}`);

        // If snapshot failed
        if (status === 'failed' || status === 'error') {
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

          failed++;
          processed++;
          continue;
        }

        // If snapshot is ready, download and process
        if (status === 'ready' || status === 'completed' || status === 'done' || status === 'success') {
          const dataResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${account.snapshot_id}/data`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            }
          );

          if (!dataResponse.ok) {
            console.log(`[Verify Accounts Worker] Data not ready for snapshot ${account.snapshot_id}`);
            stillPending++;
            continue;
          }

          const dataPayload = await dataResponse.json();
          const profileData = Array.isArray(dataPayload) && dataPayload.length > 0 
            ? dataPayload[0] 
            : dataPayload;

          if (!profileData) {
            console.log(`[Verify Accounts Worker] No profile data for snapshot ${account.snapshot_id}`);
            stillPending++;
            continue;
          }

          // Extract bio and verify code
          const bioText = extractBioFromProfileData(profileData, account.platform);
          const codeFound = verifyCodeInBio(bioText, account.verification_code);

          console.log(`[Verify Accounts Worker] Account ${account.id}: code found = ${codeFound}`);

          // Update account
          const updateData: any = {
            profile_data: profileData,
            webhook_status: 'COMPLETED',
            last_verification_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (codeFound) {
            updateData.verification_status = 'VERIFIED';
            updateData.verification_attempts = 0;
            verified++;
          } else {
            updateData.verification_status = 'FAILED';
            updateData.verification_attempts = (account.verification_attempts || 0) + 1;
            failed++;
          }

          await supabaseAdmin
            .from('social_accounts')
            .update(updateData)
            .eq('id', account.id);

          processed++;
        } else {
          // Still processing
          stillPending++;
        }
      } catch (error) {
        console.error(`[Verify Accounts Worker] Error processing account ${account.id}:`, error);
        // Continue with next account
      }
    }

    console.log(`[Verify Accounts Worker] Completed: processed=${processed}, verified=${verified}, failed=${failed}, stillPending=${stillPending}`);

    return NextResponse.json({
      success: true,
      processed,
      verified,
      failed,
      stillPending,
    });
  } catch (error) {
    console.error('[Verify Accounts Worker] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workers/verify-accounts
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Verify accounts worker is running',
  });
}

