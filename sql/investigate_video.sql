-- ============================================================================
-- INVESTIGATE SPECIFIC VIDEO: 7417099856897953029
-- Check what hashtags it has and why cartoons (plural) isn't linked
-- ============================================================================

-- 1. Check if video exists in videos_hot
SELECT 
  video_id,
  post_id,
  url,
  caption,
  description,
  views_count,
  creator_id
FROM videos_hot
WHERE video_id = '7417099856897953029' OR post_id = '7417099856897953029';

-- 2. Check what's in videos_cold (full JSON data)
SELECT 
  video_id,
  full_json->'hashtags' AS hashtags_from_json,
  full_json->>'description' AS description
FROM videos_cold
WHERE video_id = '7417099856897953029' OR video_id IN (
  SELECT video_id FROM videos_hot WHERE post_id = '7417099856897953029'
);

-- 3. Check what hashtags are in video_hashtag_facts for this video
SELECT 
  vhf.video_id,
  vhf.hashtag,
  h.videos_count,
  h.views_total
FROM video_hashtag_facts vhf
LEFT JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
WHERE vhf.video_id = '7417099856897953029' 
   OR vhf.video_id IN (SELECT video_id FROM videos_hot WHERE post_id = '7417099856897953029');

-- 4. Check if hashtag 'cartoons' exists but is orphaned
SELECT 
  hashtag,
  hashtag_norm,
  videos_count,
  views_total,
  creators_count,
  total_impact_score,
  first_seen_at,
  last_seen_at
FROM hashtags_hot
WHERE hashtag IN ('cartoon', 'cartoons');

-- 5. Check all hashtags for videos from this creator
SELECT 
  v.video_id,
  v.url,
  vhf.hashtag,
  h.videos_count
FROM videos_hot v
LEFT JOIN video_hashtag_facts vhf ON vhf.video_id = v.video_id
LEFT JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
WHERE v.creator_id = '6822973263813133317'
ORDER BY v.video_id, vhf.hashtag;

-- 6. Check if there are any hashtags in hashtags_hot that have no facts entries
SELECT 
  h.hashtag,
  h.videos_count,
  COUNT(vhf.video_id) AS actual_video_count
FROM hashtags_hot h
LEFT JOIN video_hashtag_facts vhf ON vhf.hashtag = h.hashtag
WHERE h.hashtag ILIKE '%cartoon%'
GROUP BY h.hashtag, h.videos_count;

