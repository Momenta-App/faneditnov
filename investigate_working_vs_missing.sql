-- Investigate why one video worked but others didn't

-- 1. Check the working video details
SELECT 
  video_id,
  post_id,
  url,
  caption,
  platform,
  is_edit,
  created_at,
  first_seen_at,
  updated_at
FROM videos_hot
WHERE url LIKE '%7517399973638556958%'
   OR url LIKE '%alisedit3.0%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if any of the missing videos were rejected
SELECT 
  post_id,
  creator_id,
  tiktok_url as video_url,
  rejection_reason,
  rejected_at
FROM rejected_videos
WHERE tiktok_url LIKE '%7576017518142262535%'
   OR tiktok_url LIKE '%7543981402233081110%'
   OR tiktok_url LIKE '%7211925800981990662%'
   OR tiktok_url LIKE '%7520851638886681912%'
ORDER BY rejected_at DESC;

-- 3. Check if there are any videos in videos_hot from around those dates
-- (to see if ingestion was working at all)
SELECT 
  COUNT(*) as total_videos,
  COUNT(CASE WHEN is_edit = TRUE THEN 1 END) as edit_videos,
  COUNT(CASE WHEN is_edit = FALSE THEN 1 END) as non_edit_videos,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM videos_hot
WHERE created_at >= '2025-11-24'
  AND created_at <= '2025-11-26';

-- 4. Check recent videos to see if ANY videos are being added
SELECT 
  video_id,
  url,
  platform,
  is_edit,
  created_at,
  first_seen_at
FROM videos_hot
ORDER BY COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 10;

