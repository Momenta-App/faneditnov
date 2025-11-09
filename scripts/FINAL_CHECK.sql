-- Final check to verify everything is working

-- Check creators table - do they have total_play_count?
SELECT 
  creator_id, 
  username, 
  total_play_count,
  videos_count
FROM creators_hot
LIMIT 10;

-- Check if video history is working
SELECT 
  video_id, 
  previous_play_count, 
  last_updated
FROM video_play_count_history;

-- See what the 4 videos look like
SELECT 
  video_id,
  creator_id,
  views_count,
  created_at
FROM videos_hot
ORDER BY views_count DESC;

