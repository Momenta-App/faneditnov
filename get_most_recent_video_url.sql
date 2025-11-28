-- Find the most recent video added to videos_hot
SELECT 
  video_id,
  post_id,
  creator_id,
  COALESCE(url, video_url) as video_url,
  url as social_platform_url,
  video_url as cdn_url,
  caption,
  description,
  platform,
  is_edit,
  views_count,
  likes_count,
  comments_count,
  created_at,
  first_seen_at,
  last_seen_at,
  updated_at
FROM videos_hot
ORDER BY 
  COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 1;

