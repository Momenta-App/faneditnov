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

    // Extract video URL and snapshot ID to find submission
    const videoUrl = record.url || record.video_url || record.post_url;
    const snapshotId = record.snapshot_id || record.id || record.collection_id;
    
    if (!videoUrl) {
      console.error('[Contest Webhook] No video URL in payload');
      return NextResponse.json({ error: 'No video URL' }, { status: 400 });
    }

    console.log('[Contest Webhook] Received webhook:', { videoUrl, snapshotId });

    // Try to find submission by snapshot_id first (most reliable)
    let submission: any = null;
    let submissionError: any = null;

    if (snapshotId) {
      const { data, error } = await supabaseAdmin
        .from('contest_submissions')
        .select(`
          *,
          contests:contest_id (
            id,
            required_hashtags,
            required_description_template
          )
        `)
        .eq('snapshot_id', snapshotId)
        .maybeSingle();

      if (!error && data) {
        submission = data;
        console.log('[Contest Webhook] Found submission by snapshot_id:', snapshotId);
      } else {
        console.warn('[Contest Webhook] No submission found by snapshot_id:', snapshotId);
      }
    }

    // Fallback: Find submission by URL and processing status
    if (!submission) {
      const { data, error } = await supabaseAdmin
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

      submission = data;
      submissionError = error;

      if (submission) {
        console.log('[Contest Webhook] Found submission by URL (fallback):', videoUrl);
        // Update with snapshot_id if we have it
        if (snapshotId) {
          await supabaseAdmin
            .from('contest_submissions')
            .update({ snapshot_id: snapshotId })
            .eq('id', submission.id);
        }
      }
    }

    if (submissionError || !submission) {
      console.error('[Contest Webhook] Submission not found:', {
        videoUrl,
        snapshotId,
        error: submissionError?.message,
      });
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

    // Extract description and hashtags from BrightData
    const descriptionText = record.description || record.caption || record.text || '';
    
    // Extract hashtags from multiple sources
    const hashtags: string[] = [];
    
    // 1. Check if BrightData provides a separate hashtags array
    if (record.hashtags) {
      if (Array.isArray(record.hashtags)) {
        for (const item of record.hashtags) {
          if (typeof item === 'string') {
            hashtags.push(item);
          } else if (item && typeof item === 'object') {
            if (item.hashtag) {
              hashtags.push(item.hashtag);
            } else if (item.tag) {
              hashtags.push(item.tag);
            }
          }
        }
      }
    }
    
    // 2. Extract hashtags from description/caption text
    const textHashtags = extractHashtags(descriptionText);
    hashtags.push(...textHashtags);
    
    // Remove duplicates and normalize
    const uniqueHashtags = [...new Set(hashtags.map(h => h.startsWith('#') ? h : `#${h}`))];

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
        description_text: descriptionText || null,
        hashtags_array: uniqueHashtags.length > 0 ? uniqueHashtags : null,
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

  // Extract hashtags from multiple sources
  const hashtags: string[] = [];

  // 1. Check if BrightData provides a separate hashtags array
  if (record.hashtags) {
    if (Array.isArray(record.hashtags)) {
      // Handle different formats: array of strings or array of objects
      for (const item of record.hashtags) {
        if (typeof item === 'string') {
          hashtags.push(item);
        } else if (item && typeof item === 'object') {
          // Format: { hashtag: "#tag", link: "..." }
          if (item.hashtag) {
            hashtags.push(item.hashtag);
          } else if (item.tag) {
            hashtags.push(item.tag);
          }
        }
      }
    }
  }

  // 2. Extract hashtags from description/caption text
  const description = record.description || record.caption || record.text || '';
  const textHashtags = extractHashtags(description);
  hashtags.push(...textHashtags);

  // Remove duplicates
  const uniqueHashtags = [...new Set(hashtags)];

  // Normalize hashtags (remove # and lowercase)
  const normalizedRequired = requiredHashtags.map((h) =>
    h.replace('#', '').toLowerCase().trim()
  );
  const normalizedFound = uniqueHashtags.map((h) =>
    h.replace('#', '').toLowerCase().trim()
  );

  console.log('[Contest Webhook] Hashtag check:', {
    required: normalizedRequired,
    found: normalizedFound,
    platform,
  });

  // Check if all required hashtags are present
  // Use exact match or substring match (for variations like #tag vs #tagged)
  const allPresent = normalizedRequired.every((required) => {
    return normalizedFound.some((found) => {
      // Exact match
      if (found === required) return true;
      // Substring match (found contains required or vice versa)
      if (found.includes(required) || required.includes(found)) return true;
      return false;
    });
  });

  return allPresent ? 'pass' : 'fail';
}

/**
 * Extract hashtags from text using regex
 * Handles various formats: #tag, #TAG, #tag123, etc.
 */
function extractHashtags(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Match hashtags: # followed by word characters (letters, numbers, underscore)
  // Also handles unicode characters in hashtags
  const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
  const matches = text.match(hashtagRegex);
  return matches || [];
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

  // Get description from multiple possible fields
  const description = record.description || record.caption || record.text || record.title || '';
  
  if (!description || description.trim().length === 0) {
    console.log('[Contest Webhook] No description found in record');
    return 'fail';
  }

  const normalizedDescription = description.toLowerCase().trim();
  const normalizedTemplate = template.toLowerCase().trim();

  // First, try exact match (case-insensitive)
  if (normalizedDescription === normalizedTemplate) {
    return 'pass';
  }

  // Try substring match (description contains template)
  if (normalizedDescription.includes(normalizedTemplate)) {
    return 'pass';
  }

  // Extract key phrases from template (words longer than 3 chars, excluding common words)
  const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  
  const templateWords = normalizedTemplate
    .split(/\s+/)
    .map(w => w.replace(/[^\w]/g, '')) // Remove punctuation
    .filter((w) => w.length > 3 && !commonWords.has(w)); // Filter out short words and common words

  if (templateWords.length === 0) {
    // If template is too short or only common words, use substring match
    return normalizedDescription.includes(normalizedTemplate) ? 'pass' : 'fail';
  }

  // Check if key phrases from template appear in description
  const matches = templateWords.filter((word) =>
    normalizedDescription.includes(word)
  );

  // Calculate match ratio
  const matchRatio = matches.length / templateWords.length;
  
  console.log('[Contest Webhook] Description check:', {
    templateWords,
    matches: matches.length,
    totalWords: templateWords.length,
    matchRatio,
    platform,
  });

  // If at least 60% of key words match, consider it a pass
  // Increased threshold from 50% to 60% for better accuracy
  return matchRatio >= 0.6 ? 'pass' : 'fail';
}

