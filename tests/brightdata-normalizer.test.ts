import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBrightDataRecord } from '../src/lib/brightdata-normalizer';

test('normalizes TikTok metrics using BrightData keys', () => {
  const record = {
    url: 'https://www.tiktok.com/@creator/video/123',
    play_count: 1000,
    digg_count: 200,
    comment_count: 50,
    share_count: 25,
    collect_count: 10,
  };

  const result = normalizeBrightDataRecord(record);
  assert.equal(result.platform, 'tiktok');
  assert.equal(result.normalized_metrics.total_views, 1000);
  assert.equal(result.normalized_metrics.like_count, 200);
  assert.equal(result.normalized_metrics.comment_count, 50);
  assert.equal(result.normalized_metrics.share_count, 25);
  assert.equal(result.normalized_metrics.save_count, 10);
});

test('prefers Instagram video_play_count over views', () => {
  const record = {
    url: 'https://www.instagram.com/reel/ABC123',
    views: 5000,
    video_play_count: 7500,
    likes: '400 likes',
    num_comments: '1.2k comments',
    share_count: 12,
    save_count: 9,
  };

  const result = normalizeBrightDataRecord(record);
  assert.equal(result.platform, 'instagram');
  assert.equal(result.normalized_metrics.total_views, 7500);
  assert.equal(result.normalized_metrics.like_count, 400);
  assert.equal(result.normalized_metrics.comment_count, 1200);
  assert.equal(result.normalized_metrics.share_count, 12);
  assert.equal(result.normalized_metrics.save_count, 9);
});

test('maps YouTube Shorts stats and defaults missing fields to zero', () => {
  const record = {
    url: 'https://www.youtube.com/shorts/XYZ789',
    views: '12000',
    likes: '900',
    num_comments: '60',
  };

  const result = normalizeBrightDataRecord(record);
  assert.equal(result.platform, 'youtube');
  assert.equal(result.normalized_metrics.total_views, 12000);
  assert.equal(result.normalized_metrics.like_count, 900);
  assert.equal(result.normalized_metrics.comment_count, 60);
  assert.equal(result.normalized_metrics.share_count, 0);
  assert.equal(result.normalized_metrics.save_count, 0);
});

