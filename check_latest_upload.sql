-- Check your LATEST test upload (right now)

-- 1. Most recent submission_metadata (your test upload from today)
SELECT 
  snapshot_id,
  video_urls[1] as video_url,
  skip_validation,
  created_at,
  NOW() - created_at as time_ago
FROM submission_metadata
ORDER BY created_at DESC
LIMIT 1;

-- 2. Most recent videos added (should show your test if it worked)
SELECT 
  video_id,
  url,
  platform,
  is_edit,
  first_seen_at,
  created_at,
  NOW() - COALESCE(first_seen_at, created_at) as time_since_added
FROM videos_hot
ORDER BY COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 3;

-- 3. Check if the URL from your most recent submission exists in videos_hot
WITH latest_submission AS (
  SELECT 
    snapshot_id,
    video_urls[1] as video_url,
    skip_validation,
    created_at
  FROM submission_metadata
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  ls.snapshot_id,
  ls.video_url as submission_url,
  ls.skip_validation,
  ls.created_at as submitted_at,
  vh.video_id,
  vh.url as video_hot_url,
  vh.is_edit,
  vh.first_seen_at,
  CASE 
    WHEN vh.video_id IS NOT NULL THEN '✅ Video EXISTS in videos_hot'
    WHEN ls.snapshot_id LIKE 'pending_%' THEN '⏳ Still waiting for BrightData'
    ELSE '❌ Video MISSING - check server logs for errors'
  END as status
FROM latest_submission ls
LEFT JOIN videos_hot vh ON vh.url = ls.video_url 
   OR vh.url LIKE '%' || SPLIT_PART(ls.video_url, '/video/', 2) || '%'
ORDER BY ls.created_at DESC;

