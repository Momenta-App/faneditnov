-- ============================================================================
-- CHECK INSTAGRAM VIDEO IMPACT SCORES
-- This script checks why Instagram videos might not appear when sorting by impact
-- ============================================================================

-- Check the Instagram video's current impact score and metrics
SELECT 
  video_id,
  post_id,
  platform,
  views_count,
  likes_count,
  comments_count,
  shares_count,
  collect_count,
  impact_score,
  -- Calculate what the impact score should be
  ROUND(
    100.0 * COALESCE(comments_count, 0)
    + 0.1 * COALESCE(shares_count, 0)
    + 0.001 * COALESCE(likes_count, 0)
    + COALESCE(views_count, 0) / 100000.0
    + 0.1 * COALESCE(collect_count, 0)
  , 2) AS calculated_impact,
  impact_updated_at,
  created_at
FROM videos_hot
WHERE platform = 'instagram'
ORDER BY created_at DESC
LIMIT 5;

-- Check if there are any Instagram videos with NULL or 0 impact_score
SELECT 
  COUNT(*) FILTER (WHERE impact_score IS NULL) AS null_impact_count,
  COUNT(*) FILTER (WHERE impact_score = 0) AS zero_impact_count,
  COUNT(*) FILTER (WHERE impact_score > 0) AS positive_impact_count,
  COUNT(*) AS total_instagram_videos
FROM videos_hot
WHERE platform = 'instagram';

-- Compare Instagram video impact scores with other videos
SELECT 
  platform,
  COUNT(*) AS video_count,
  AVG(impact_score) AS avg_impact,
  MIN(impact_score) AS min_impact,
  MAX(impact_score) AS max_impact,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY impact_score) AS median_impact
FROM videos_hot
GROUP BY platform;

-- Show top 20 videos by impact score (to see where Instagram videos rank)
SELECT 
  video_id,
  post_id,
  platform,
  views_count,
  likes_count,
  comments_count,
  impact_score,
  created_at
FROM videos_hot
ORDER BY impact_score DESC NULLS LAST
LIMIT 20;




