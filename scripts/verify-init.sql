-- Verification queries to check initialization status

-- 1. Check if creators were updated
SELECT 
  'Creators with total_play_count > 0' as check_name,
  COUNT(*) as count,
  SUM(total_play_count) as total_views
FROM creators_hot
WHERE total_play_count > 0;

-- 2. Check total creators vs those with data
SELECT 
  'Total creators in table' as check_name,
  COUNT(*) as count
FROM creators_hot;

-- 3. Check if creators have videos
SELECT 
  'Creators that have videos' as check_name,
  COUNT(DISTINCT creator_id) as count
FROM videos_hot;

-- 4. Check video history records created
SELECT 
  'Video history records' as check_name,
  COUNT(*) as count
FROM video_play_count_history;

-- 5. Check if sounds were updated
SELECT 
  'Sounds with views_total > 0' as check_name,
  COUNT(*) as count,
  SUM(views_total) as total_views
FROM sounds_hot
WHERE views_total > 0;

-- 6. Check total sounds vs those with data
SELECT 
  'Total sounds in table' as check_name,
  COUNT(*) as count
FROM sounds_hot;

-- 7. Check if sounds are linked to videos via facts table
SELECT 
  'Sounds linked to videos' as check_name,
  COUNT(DISTINCT sound_id) as count
FROM video_sound_facts;

-- 8. Sample data check - show top creators
SELECT 
  'Top 5 Creators by total_play_count' as check_name,
  creator_id,
  username,
  total_play_count,
  videos_count
FROM creators_hot
ORDER BY total_play_count DESC
LIMIT 5;

-- 9. Sample data check - show some videos
SELECT 
  'Top 5 Videos by views_count' as check_name,
  video_id,
  creator_id,
  views_count
FROM videos_hot
ORDER BY views_count DESC
LIMIT 5;

-- 10. Check if history records exist for those videos
SELECT 
  'History records for top videos' as check_name,
  COUNT(*) as count
FROM video_play_count_history vph
WHERE vph.video_id IN (
  SELECT video_id FROM videos_hot ORDER BY views_count DESC LIMIT 5
);

