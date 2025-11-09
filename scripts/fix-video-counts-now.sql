-- Fix video counts immediately for all creators
-- This updates videos_count in creators_hot based on actual videos in videos_hot

-- First, let's see what's wrong
SELECT 
  'Before Update' as status,
  c.creator_id,
  c.username,
  c.videos_count as current_count,
  COUNT(v.video_id) as actual_video_count,
  c.total_play_count
FROM creators_hot c
LEFT JOIN videos_hot v ON c.creator_id = v.creator_id
GROUP BY c.creator_id, c.username, c.videos_count, c.total_play_count
HAVING c.videos_count != COUNT(v.video_id)
ORDER BY COUNT(v.video_id) DESC;

-- Update the counts
UPDATE creators_hot c
SET 
  videos_count = (
    SELECT COUNT(*)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
);

-- Verify the fix
SELECT 
  'After Update' as status,
  c.creator_id,
  c.username,
  c.videos_count,
  COUNT(v.video_id) as actual_count,
  c.total_play_count
FROM creators_hot c
LEFT JOIN videos_hot v ON c.creator_id = v.creator_id
GROUP BY c.creator_id, c.username, c.videos_count, c.total_play_count
HAVING c.videos_count != COUNT(v.video_id)
ORDER BY c.videos_count DESC;

-- Final summary
SELECT 
  COUNT(*) as total_creators,
  SUM(videos_count) as total_videos,
  SUM(total_play_count) as total_views
FROM creators_hot;

