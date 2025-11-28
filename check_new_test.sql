-- Check your NEW test upload with the specific URL

-- 1. Find submission_metadata for your test video
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at,
  NOW() - created_at as time_ago,
  CASE 
    WHEN snapshot_id LIKE 'pending_%' THEN '⏳ Waiting for BrightData'
    ELSE '✅ Processed by BrightData'
  END as status
FROM submission_metadata
WHERE 'https://www.tiktok.com/@sav.edits001/video/7558397212150009110' = ANY(video_urls)
   OR video_urls[1] LIKE '%7558397212150009110%'
   OR video_urls[1] LIKE '%sav.edits001%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if the video exists in videos_hot
SELECT 
  video_id,
  url,
  platform,
  is_edit,
  first_seen_at,
  created_at,
  CASE 
    WHEN is_edit = TRUE THEN '✅ is_edit = TRUE'
    WHEN is_edit = FALSE THEN '❌ is_edit = FALSE'
    ELSE '❓ is_edit is NULL'
  END as edit_status
FROM videos_hot
WHERE url LIKE '%7558397212150009110%'
   OR url LIKE '%sav.edits001%'
   OR video_id = '7558397212150009110'
ORDER BY first_seen_at DESC
LIMIT 5;

-- 3. Check ALL recent submissions (to see if your new one is there)
SELECT 
  snapshot_id,
  video_urls[1] as video_url,
  skip_validation,
  created_at,
  NOW() - created_at as time_ago
FROM submission_metadata
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if it was rejected
SELECT 
  post_id,
  tiktok_url,
  rejection_reason,
  rejected_at
FROM rejected_videos
WHERE tiktok_url LIKE '%7558397212150009110%'
   OR tiktok_url LIKE '%sav.edits001%'
ORDER BY rejected_at DESC;

