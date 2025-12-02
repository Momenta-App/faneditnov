/**
 * Test script to verify contest submission stats extraction
 * Tests the stats extraction logic with a sample BrightData payload
 */

import { supabaseAdmin } from '../src/lib/supabase';
import { attachNormalizedMetrics } from '../src/lib/brightdata-normalizer';

// Sample TikTok BrightData payload structure
const sampleTikTokPayload = {
  url: 'https://www.tiktok.com/@001.xhk/video/7571819475733990663',
  post_id: '7571819475733990663',
  play_count: 1234567,
  digg_count: 89000,
  comment_count: 1234,
  share_count: 567,
  collect_count: 890,
  description: 'Test video description',
  hashtags: ['#fyp', '#viral', '#edit'],
};

async function testStatsExtraction() {
  console.log('=== Testing Contest Stats Extraction ===\n');

  // Step 1: Normalize the payload
  console.log('1. Normalizing payload...');
  const normalized = attachNormalizedMetrics(sampleTikTokPayload);
  console.log('Normalized payload keys:', Object.keys(normalized).slice(0, 20));
  console.log('Has normalized_metrics:', !!normalized.normalized_metrics);
  if (normalized.normalized_metrics) {
    console.log('Normalized metrics:', normalized.normalized_metrics);
  }

  // Step 2: Extract stats using the same logic as contest webhook
  console.log('\n2. Extracting stats...');
  const platform = 'tiktok';
  const processedRecord = normalized;
  const normalizedMetrics = processedRecord.normalized_metrics || null;

  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let saves = 0;

  if (platform === 'tiktok') {
    views = processedRecord.play_count || 0;
    likes = processedRecord.digg_count || 0;
    comments = processedRecord.comment_count || 0;
    shares = processedRecord.share_count || 0;
    saves = processedRecord.collect_count || 0;
  }

  if (normalizedMetrics) {
    views = normalizedMetrics.total_views ?? views;
    likes = normalizedMetrics.like_count ?? likes;
    comments = normalizedMetrics.comment_count ?? comments;
    shares = normalizedMetrics.share_count ?? shares;
    saves = normalizedMetrics.save_count ?? saves;
  }

  views = Number(views) || 0;
  likes = Number(likes) || 0;
  comments = Number(comments) || 0;
  shares = Number(shares) || 0;
  saves = Number(saves) || 0;

  console.log('Extracted stats:', {
    views,
    likes,
    comments,
    shares,
    saves,
  });

  // Step 3: Calculate impact score
  const impactScore = Math.round(
    ((100.0 * comments) +
     (0.001 * likes) +
     (views / 100000.0)) * 100
  ) / 100;

  console.log('\n3. Calculated impact score:', impactScore);

  // Step 4: Test database update (find a test submission)
  console.log('\n4. Testing database update...');
  const testSubmissionId = 60; // From user's data

  const statsUpdateData: any = {
    views_count: views,
    likes_count: likes,
    comments_count: comments,
    shares_count: shares,
    saves_count: saves,
    impact_score: impactScore,
    stats_updated_at: new Date().toISOString(),
    brightdata_response: processedRecord,
  };

  console.log('Update data:', {
    views_count: statsUpdateData.views_count,
    likes_count: statsUpdateData.likes_count,
    comments_count: statsUpdateData.comments_count,
    has_brightdata_response: !!statsUpdateData.brightdata_response,
  });

  const { error, data } = await supabaseAdmin
    .from('contest_submissions')
    .update(statsUpdateData)
    .eq('id', testSubmissionId)
    .select('id, views_count, likes_count, comments_count, shares_count, saves_count, impact_score, stats_updated_at, brightdata_response');

  if (error) {
    console.error('❌ Database update failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  } else {
    if (data && data.length > 0) {
      console.log('✅ Database update successful!');
      console.log('Updated row:', data[0]);
    } else {
      console.error('❌ Update returned no rows');
    }
  }

  console.log('\n=== Test Complete ===');
}

testStatsExtraction().catch(console.error);

