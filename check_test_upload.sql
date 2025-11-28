-- Check if your test upload worked

-- 1. Check the most recent submission_metadata (your test upload)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at,
  CASE 
    WHEN snapshot_id LIKE 'pending_%' THEN 'Waiting for BrightData'
    ELSE 'Processed by BrightData'
  END as status
FROM submission_metadata
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if the video was added to videos_hot (most recent)
SELECT 
  video_id,
  url,
  caption,
  platform,
  is_edit,
  created_at,
  first_seen_at,
  updated_at
FROM videos_hot
ORDER BY COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 5;

-- 3. Check if video was rejected
SELECT 
  post_id,
  tiktok_url as video_url,
  rejection_reason,
  rejected_at
FROM rejected_videos
ORDER BY rejected_at DESC
LIMIT 5;

-- 4. Cross-check: Find videos added in the last 10 minutes
SELECT 
  vh.video_id,
  vh.url,
  vh.is_edit,
  vh.first_seen_at,
  sm.skip_validation,
  CASE 
    WHEN vh.is_edit = TRUE AND sm.skip_validation = TRUE THEN '✅ Bypass upload - is_edit = TRUE (correct)'
    WHEN vh.is_edit = TRUE AND sm.skip_validation = FALSE THEN '✅ Regular upload with edit hashtag - is_edit = TRUE (correct)'
    WHEN vh.is_edit = FALSE THEN '⚠️ is_edit = FALSE (might be issue)'
    ELSE '❓ Unknown status'
  END as status_check
FROM videos_hot vh
LEFT JOIN submission_metadata sm ON vh.url = ANY(sm.video_urls)
WHERE vh.first_seen_at >= NOW() - INTERVAL '10 minutes'
   OR vh.created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY COALESCE(vh.first_seen_at, vh.created_at) DESC;

