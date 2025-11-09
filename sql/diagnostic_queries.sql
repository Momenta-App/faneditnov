-- ============================================================================
-- DIAGNOSTIC QUERIES
-- Use these to investigate what data exists and why it's not showing
-- ============================================================================

-- 1. Check if the video exists
SELECT 
  v.video_id,
  v.url,
  v.views_count,
  v.likes_count,
  v.creator_id,
  c.username,
  c.total_play_count,
  c.videos_count
FROM videos_hot v
LEFT JOIN creators_hot c ON c.creator_id = v.creator_id
WHERE c.creator_id = '6822973263813133317'
ORDER BY v.views_count DESC;

-- 2. Check what hashtags this video has
SELECT DISTINCT
  v.video_id,
  v.url,
  vhf.hashtag,
  h.videos_count,
  h.views_total,
  h.creators_count
FROM videos_hot v
LEFT JOIN video_hashtag_facts vhf ON vhf.video_id = v.video_id
LEFT JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
WHERE v.creator_id = '6822973263813133317';

-- 3. Find all hashtags with 'cartoon' in the name
SELECT 
  hashtag,
  hashtag_norm,
  videos_count,
  views_total,
  creators_count,
  likes_total
FROM hashtags_hot
WHERE 
  hashtag ILIKE '%cartoon%' 
  OR hashtag_norm ILIKE '%cartoon%'
ORDER BY videos_count DESC;

-- 4. Check video_hashtag_facts table
SELECT 
  vhf.video_id,
  vhf.hashtag,
  vhf.views_at_snapshot,
  v.views_count AS current_views,
  c.username
FROM video_hashtag_facts vhf
JOIN videos_hot v ON v.video_id = vhf.video_id
JOIN creators_hot c ON c.creator_id = v.creator_id
WHERE vhf.hashtag ILIKE '%cartoon%'
ORDER BY v.views_count DESC;

-- 5. Check what sound the video uses
SELECT 
  v.video_id,
  v.url,
  vsf.sound_id,
  s.sound_title,
  s.sound_author,
  s.videos_count,
  s.views_total
FROM videos_hot v
LEFT JOIN video_sound_facts vsf ON vsf.video_id = v.video_id
LEFT JOIN sounds_hot s ON s.sound_id = vsf.sound_id
WHERE v.creator_id = '6822973263813133317';

-- 6. Check if data exists in cold storage
SELECT 
  video_id,
  full_json->>'description' AS description,
  full_json->'hashtags' AS hashtags_json
FROM videos_cold
WHERE video_id IN (
  SELECT video_id FROM videos_hot WHERE creator_id = '6822973263813133317'
)
LIMIT 1;

-- 7. Top creators by total_play_count
SELECT 
  creator_id,
  username,
  display_name,
  total_play_count,
  videos_count,
  likes_total,
  followers_count
FROM creators_hot
ORDER BY total_play_count DESC NULLS LAST
LIMIT 20;

-- 8. Check if the creator exists but has zero stats
SELECT 
  creator_id,
  username,
  display_name,
  COALESCE(total_play_count, 0) AS total_play_count,
  COALESCE(videos_count, 0) AS videos_count,
  COALESCE(likes_total, 0) AS likes_total,
  followers_count
FROM creators_hot
WHERE creator_id = '6822973263813133317';

-- 9. Check video_play_count_history
SELECT 
  vph.video_id,
  vph.previous_play_count,
  v.views_count AS current_views,
  v.url
FROM video_play_count_history vph
JOIN videos_hot v ON v.video_id = vph.video_id
WHERE v.creator_id = '6822973263813133317';

-- 10. Check if update_aggregations function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'update_aggregations'
  AND routine_schema = 'public';

