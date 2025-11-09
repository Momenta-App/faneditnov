-- Populate total_play_count column in creators_hot
-- This should be run after adding the column

-- Method 1: Update manually for all creators
UPDATE creators_hot c
SET 
  total_play_count = (
    SELECT COALESCE(SUM(views_count), 0)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  );

-- Method 2: Use the aggregation function (recommended)
-- SELECT update_aggregations();

-- Verify the results
SELECT 
  creator_id, 
  username, 
  videos_count, 
  total_play_count, 
  likes_total,
  CASE 
    WHEN videos_count = 0 THEN 0
    ELSE ROUND(total_play_count::numeric / videos_count, 0)
  END as avg_views_per_video
FROM creators_hot 
WHERE total_play_count > 0
ORDER BY total_play_count DESC
LIMIT 20;

