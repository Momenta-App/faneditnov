-- Investigate why submissions are stuck pending and check new test upload

-- 1. Check if your NEW test upload exists (with bypass)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at
FROM submission_metadata
WHERE video_urls[1] LIKE '%sav.edits001%'
   OR video_urls[1] LIKE '%7558397212150009110%'
   OR created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 2. Check how many submissions are stuck pending (more than 10 minutes)
SELECT 
  COUNT(*) as stuck_pending_count,
  MIN(created_at) as oldest_pending,
  MAX(created_at) as newest_pending,
  NOW() - MIN(created_at) as oldest_waiting_time
FROM submission_metadata
WHERE snapshot_id LIKE 'pending_%'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- 3. Check if ANY submissions with skip_validation = true exist (bypass uploads)
SELECT 
  snapshot_id,
  video_urls[1] as video_url,
  skip_validation,
  created_at,
  CASE 
    WHEN snapshot_id LIKE 'pending_%' THEN 'Still pending'
    ELSE 'Processed'
  END as status
FROM submission_metadata
WHERE skip_validation = true
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if BrightData is processing anything - look for non-pending snapshots
SELECT 
  COUNT(*) as processed_count,
  MIN(created_at) as oldest_processed,
  MAX(created_at) as newest_processed
FROM submission_metadata
WHERE snapshot_id NOT LIKE 'pending_%'
  AND created_at >= NOW() - INTERVAL '24 hours';

