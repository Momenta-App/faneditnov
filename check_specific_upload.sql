-- Check what happened to this specific upload
-- Replace the URL below with the actual video URL if different

-- 1. Check if video was rejected
SELECT 
  post_id,
  creator_id,
  tiktok_url as video_url,
  rejection_reason,
  rejected_at,
  hashtags
FROM rejected_videos
WHERE tiktok_url LIKE '%7396037000240942379%'
   OR standardized_url LIKE '%7396037000240942379%'
ORDER BY rejected_at DESC
LIMIT 5;

-- 2. Check if video exists in videos_hot (by URL or post_id)
SELECT 
  video_id,
  post_id,
  url,
  caption,
  platform,
  is_edit,
  created_at,
  first_seen_at
FROM videos_hot
WHERE url LIKE '%7396037000240942379%'
   OR post_id LIKE '%7396037000240942379%'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check submission_metadata for this snapshot
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  submitted_by,
  created_at
FROM submission_metadata
WHERE snapshot_id = 'pending_1764318197771_gw8pmgs2j'
   OR 'https://www.tiktok.com/@renzz.ae/video/7396037000240942379' = ANY(video_urls)
ORDER BY created_at DESC;

-- 4. Check if BrightData webhook was called (if bd_ingestions table exists)
-- Uncomment if you've run sql/032_bd_ingestions_table.sql
/*
SELECT 
  snapshot_id,
  status,
  error,
  processed_count,
  created_at,
  updated_at
FROM bd_ingestions
WHERE snapshot_id LIKE '%1764318197771%'
   OR snapshot_id = 'pending_1764318197771_gw8pmgs2j'
ORDER BY created_at DESC;
*/

