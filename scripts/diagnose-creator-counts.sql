-- Diagnose the discrepancy between videos_count and total_play_count

-- 1. Check individual creator data
SELECT 
  creator_id,
  username,
  videos_count,
  total_play_count,
  likes_total,
  CASE 
    WHEN videos_count = 0 AND total_play_count > 0 THEN 'MISMATCH: Has views but no videos'
    WHEN videos_count > 0 AND total_play_count = 0 THEN 'MISMATCH: Has videos but no views'
    WHEN videos_count = 0 AND total_play_count = 0 THEN 'OK: No data'
    ELSE 'OK: Data matches'
  END as status
FROM creators_hot
ORDER BY total_play_count DESC;

-- 2. Check if videos exist in videos_hot
SELECT 
  COUNT(DISTINCT video_id) as total_videos,
  COUNT(DISTINCT creator_id) as creators_with_videos,
  SUM(views_count) as total_views_in_videos_table
FROM videos_hot;

-- 3. Cross-reference: Which creators have videos?
SELECT 
  c.creator_id,
  c.username,
  c.videos_count as creators_hot_video_count,
  COUNT(v.video_id) as actual_video_count_in_videos_hot,
  COALESCE(SUM(v.views_count), 0) as actual_total_views
FROM creators_hot c
LEFT JOIN videos_hot v ON c.creator_id = v.creator_id
GROUP BY c.creator_id, c.username, c.videos_count
ORDER BY actual_total_views DESC;

-- 4. Check if the aggregation function needs to be run
SELECT 
  'videos_count mismatch' as issue,
  COUNT(*) as affected_creators
FROM creators_hot c
WHERE videos_count != (
  SELECT COUNT(*) FROM videos_hot v WHERE v.creator_id = c.creator_id
);

