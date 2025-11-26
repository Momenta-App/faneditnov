/**
 * BrightData webhook handler for contest submissions
 * Receives video stats data and updates contest submissions
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/brightdata/contest-webhook
 * Handle BrightData webhook for contest submission stats
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

    // Extract video URL to find submission
    const videoUrl = record.url || record.video_url || record.post_url;
    if (!videoUrl) {
      console.error('[Contest Webhook] No video URL in payload');
      return NextResponse.json({ error: 'No video URL' }, { status: 400 });
    }

    // Find submission by URL (try to match most recent submission in fetching_stats state)
    // This handles cases where multiple submissions might have the same URL
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contest_submissions')
      .select(`
        *,
        contests:contest_id (
          id,
          required_hashtags,
          required_description_template
        )
      `)
      .eq('original_video_url', videoUrl)
      .eq('processing_status', 'fetching_stats')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (submissionError || !submission) {
      console.error('[Contest Webhook] Submission not found for URL:', videoUrl);
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const contest = submission.contests as any;

    // Extract metrics from BrightData response
    const metrics = extractMetrics(record, submission.platform);

    // Update submission with stats
    await supabaseAdmin
      .from('contest_submissions')
      .update({
        views_count: metrics.views || 0,
        likes_count: metrics.likes || 0,
        comments_count: metrics.comments || 0,
        shares_count: metrics.shares || 0,
        saves_count: metrics.saves || 0,
        stats_updated_at: new Date().toISOString(),
        processing_status: 'checking_hashtags',
      })
      .eq('id', submission.id);

    // Impact score will be auto-calculated by trigger

    // Step 3: Perform hashtag check
    const hashtagStatus = checkHashtags(
      record,
      contest.required_hashtags || [],
      submission.platform
    );

    // Step 4: Perform description check
    const descriptionStatus = checkDescription(
      record,
      contest.required_description_template,
      submission.platform
    );

    // Update statuses
    const finalStatus =
      hashtagStatus === 'pass' && descriptionStatus === 'pass'
        ? 'approved'
        : 'waiting_review';

    await supabaseAdmin
      .from('contest_submissions')
      .update({
        hashtag_status: hashtagStatus,
        description_status: descriptionStatus,
        processing_status: finalStatus,
      })
      .eq('id', submission.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contest Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract metrics from BrightData response
 */
function extractMetrics(record: any, platform: string): {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
} {
  if (platform === 'tiktok') {
    return {
      views: record.play_count || record.view_count || record.views || 0,
      likes: record.digg_count || record.likes || record.like_count || 0,
      comments: record.comment_count || record.comments || 0,
      shares: record.share_count || record.shares || 0,
      saves: record.collect_count || record.saves || 0,
    };
  } else if (platform === 'instagram') {
    return {
      views: record.view_count || record.views || 0,
      likes: record.like_count || record.likes || 0,
      comments: record.comment_count || record.comments || 0,
      shares: record.share_count || record.shares || 0,
      saves: record.save_count || record.saves || 0,
    };
  } else if (platform === 'youtube') {
    return {
      views: record.view_count || record.views || 0,
      likes: record.like_count || record.likes || 0,
      comments: record.comment_count || record.comments || 0,
      shares: record.share_count || record.shares || 0,
      saves: 0, // YouTube doesn't have saves
    };
  }

  return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
}

/**
 * Check if required hashtags are present
 */
function checkHashtags(
  record: any,
  requiredHashtags: string[],
  platform: string
): 'pass' | 'fail' | 'pending_review' {
  if (requiredHashtags.length === 0) {
    return 'pass';
  }

  // Extract hashtags from description/caption
  const description = record.description || record.caption || record.text || '';
  const hashtags = extractHashtags(description);

  // Normalize hashtags (remove # and lowercase)
  const normalizedRequired = requiredHashtags.map((h) =>
    h.replace('#', '').toLowerCase()
  );
  const normalizedFound = hashtags.map((h) => h.replace('#', '').toLowerCase());

  // Check if all required hashtags are present
  const allPresent = normalizedRequired.every((required) =>
    normalizedFound.some((found) => found === required || found.includes(required))
  );

  return allPresent ? 'pass' : 'fail';
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w]+/g;
  return text.match(hashtagRegex) || [];
}

/**
 * Check if description matches template
 */
function checkDescription(
  record: any,
  template: string | null,
  platform: string
): 'pass' | 'fail' | 'pending_review' {
  if (!template) {
    return 'pass'; // No template required
  }

  const description = record.description || record.caption || record.text || '';
  const normalizedDescription = description.toLowerCase();
  const normalizedTemplate = template.toLowerCase();

  // Simple pattern matching - check if key phrases from template appear in description
  // This is intentionally flexible
  const templateWords = normalizedTemplate
    .split(/\s+/)
    .filter((w) => w.length > 3); // Filter out short words

  const matches = templateWords.filter((word) =>
    normalizedDescription.includes(word)
  );

  // If at least 50% of template words match, consider it a pass
  const matchRatio = matches.length / templateWords.length;
  return matchRatio >= 0.5 ? 'pass' : 'fail';
}

