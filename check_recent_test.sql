-- Check your most recent test upload (bypass enabled)

-- 1. Most recent submission_metadata (should show your test upload)
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
ORDER BY created_at DESC
LIMIT 3;

-- 2. Most recent videos added to videos_hot (should include your test if it worked)
SELECT 
  video_id,
  url,
  platform,
  is_edit,
  created_at,
  first_seen_at,
  NOW() - COALESCE(first_seen_at, created_at) as time_since_added
FROM videos_hot
ORDER BY COALESCE(first_seen_at, created_at, updated_at) DESC
LIMIT 5;

-- 3. Check if your test video URL exists (replace with your actual test URL)
-- This will show if the video was added
SELECT 
  video_id,
  url,
  is_edit,
  first_seen_at,
  CASE 
    WHEN is_edit = TRUE THEN '✅ is_edit = TRUE (correct for bypass)'
    ELSE '❌ is_edit = FALSE (should be TRUE for bypass)'
  END as status
FROM videos_hot
WHERE url LIKE '%pjoswfts%'
   OR url LIKE '%7572643018394635551%'
   OR first_seen_at >= NOW() - INTERVAL '30 minutes'
ORDER BY first_seen_at DESC
LIMIT 5;

