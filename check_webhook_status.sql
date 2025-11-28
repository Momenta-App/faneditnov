-- Check the status of this upload and webhook processing

-- 1. Check if snapshot_id was updated (BrightData processed it)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  submitted_by,
  created_at,
  CASE 
    WHEN snapshot_id LIKE 'pending_%' THEN 'Still pending - BrightData not processed yet'
    ELSE 'Processed - snapshot_id updated'
  END as status
FROM submission_metadata
WHERE snapshot_id = 'pending_1764318197771_gw8pmgs2j'
   OR 'https://www.tiktok.com/@renzz.ae/video/7396037000240942379' = ANY(video_urls)
ORDER BY created_at DESC;

-- 2. Check ALL recent pending submissions (not yet processed by BrightData)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at,
  NOW() - created_at as time_since_submission
FROM submission_metadata
WHERE snapshot_id LIKE 'pending_%'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if there are any non-pending submissions that succeeded
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at
FROM submission_metadata
WHERE snapshot_id NOT LIKE 'pending_%'
ORDER BY created_at DESC
LIMIT 5;

