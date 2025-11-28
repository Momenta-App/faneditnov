-- Check recent videos uploaded to videos_hot
-- This query shows the most recently added videos

SELECT 
  video_id,
  post_id,
  creator_id,
  COALESCE(url, video_url, 'No URL') as video_link,
  url as social_platform_url,
  video_url as cdn_url,
  caption,
  platform,
  is_edit,
  views_count,
  likes_count,
  created_at,
  first_seen_at,
  last_seen_at,
  updated_at
FROM videos_hot
ORDER BY 
  COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 20;

-- Also check if any videos were added in the last hour
SELECT 
  COUNT(*) as videos_in_last_hour,
  COUNT(*) FILTER (WHERE is_edit = TRUE) as edit_videos,
  COUNT(*) FILTER (WHERE is_edit = FALSE) as non_edit_videos,
  COUNT(*) FILTER (WHERE is_edit IS NULL) as null_is_edit
FROM videos_hot
WHERE 
  COALESCE(first_seen_at, created_at, updated_at) >= NOW() - INTERVAL '1 hour';

-- Check for videos added today
SELECT 
  COUNT(*) as videos_today,
  COUNT(*) FILTER (WHERE is_edit = TRUE) as edit_videos,
  COUNT(*) FILTER (WHERE is_edit = FALSE) as non_edit_videos,
  COUNT(*) FILTER (WHERE is_edit IS NULL) as null_is_edit
FROM videos_hot
WHERE 
  DATE(COALESCE(first_seen_at, created_at, updated_at)) = CURRENT_DATE;

