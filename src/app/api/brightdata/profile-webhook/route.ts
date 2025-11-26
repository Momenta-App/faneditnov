/**
 * BrightData webhook handler for profile verification
 * Receives profile data and checks for verification code in bio
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { finalizeOwnershipForSocialAccount } from '@/lib/raw-video-assets';
import { resolveOwnershipConflicts } from '@/lib/contest-ownership';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/brightdata/profile-webhook
 * Handle BrightData webhook for profile verification
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // BrightData sends data in various formats
    const data = Array.isArray(payload) ? payload : [payload];
    if (data.length === 0) {
      return NextResponse.json({ error: 'No data received' }, { status: 400 });
    }

    const record = data[0];

    // Extract profile URL to find account
    const profileUrl = record.url || record.profile_url || record.account_url;
    if (!profileUrl) {
      console.error('[Profile Webhook] No profile URL in payload');
      return NextResponse.json({ error: 'No profile URL' }, { status: 400 });
    }

    // Normalize YouTube URLs (remove /about suffix for matching)
    let normalizedUrl = profileUrl;
    if (profileUrl.includes('/about')) {
      normalizedUrl = profileUrl.replace('/about', '').replace(/\/$/, '');
    }

    // Find account by profile URL or snapshot_id
    const { data: account, error: accountError } = await supabaseAdmin
      .from('social_accounts')
      .select('*')
      .or(`profile_url.eq.${normalizedUrl},profile_url.eq.${profileUrl},snapshot_id.eq.${record.snapshot_id || ''}`)
      .eq('webhook_status', 'PENDING')
      .maybeSingle();

    if (accountError || !account) {
      console.error('[Profile Webhook] Account not found for URL:', profileUrl);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Extract bio text from profile data
    const bioText = extractBioFromProfileData(record, account.platform);

    // Check for verification code in bio
    const codeFound = verifyCodeInBio(bioText, account.verification_code);

    // Update account
    const updateData: any = {
      profile_data: record,
      webhook_status: 'COMPLETED',
      last_verification_attempt_at: new Date().toISOString(),
    };

    if (codeFound) {
      updateData.verification_status = 'VERIFIED';
      updateData.verification_attempts = 0;
    } else {
      updateData.verification_status = 'FAILED';
      updateData.verification_attempts = (account.verification_attempts || 0) + 1;
    }

    await supabaseAdmin
      .from('social_accounts')
      .update(updateData)
      .eq('id', account.id);

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

/**
 * Extract bio text from BrightData profile response
 */
function extractBioFromProfileData(profileData: any, platform: string): string {
  if (platform === 'tiktok') {
    return (
      profileData.bio ||
      profileData.bio_text ||
      profileData.description ||
      profileData.signature ||
      ''
    );
  } else if (platform === 'instagram') {
    return (
      profileData.biography ||
      profileData.bio ||
      profileData.bio_text ||
      profileData.description ||
      ''
    );
  } else if (platform === 'youtube') {
    return (
      profileData.description ||
      profileData.about ||
      profileData.bio ||
      profileData.bio_text ||
      ''
    );
  }
  return '';
}

/**
 * Check if verification code appears in bio text
 */
function verifyCodeInBio(bioText: string, verificationCode: string): boolean {
  if (!bioText || !verificationCode) return false;
  const normalizedBio = bioText.toLowerCase().replace(/\s+/g, ' ');
  const normalizedCode = verificationCode.toLowerCase();
  return normalizedBio.includes(normalizedCode);
}

