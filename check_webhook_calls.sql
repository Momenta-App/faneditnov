-- Check if webhooks were called for processed snapshots
-- This helps determine if the ingestion function was invoked

-- 1. Check submission_metadata for processed snapshots that might have failed
SELECT 
  sm.snapshot_id,
  sm.video_urls[1] as video_url,
  sm.skip_validation,
  sm.created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = sm.video_urls[1] 
         OR vh.url LIKE '%' || SPLIT_PART(sm.video_urls[1], '/video/', 2) || '%'
    ) THEN 'SUCCESS - Video exists'
    ELSE 'FAILED - Video missing'
  END as ingestion_status
FROM submission_metadata sm
WHERE sm.snapshot_id IN (
  'sd_miead50018b24c1ztx',
  'sd_mieackjd1ju29spsck',
  'sd_midc1xgh1flc1qw5uo',
  'sd_midc1ee0283s1ckfgp'
)
ORDER BY sm.created_at DESC;

-- 2. Check if there are any patterns - do bypass uploads work better?
SELECT 
  skip_validation,
  COUNT(*) as total_submissions,
  COUNT(CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = ANY(sm.video_urls)
    ) THEN 1 
  END) as successful_ingestions,
  COUNT(*) - COUNT(CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = ANY(sm.video_urls)
    ) THEN 1 
  END) as failed_ingestions
FROM submission_metadata sm
WHERE sm.created_at >= '2025-11-24'
  AND sm.snapshot_id NOT LIKE 'pending_%'
GROUP BY skip_validation;

-- 3. Check recent successful ingestions to see when they worked
SELECT 
  vh.video_id,
  vh.url,
  vh.is_edit,
  vh.first_seen_at,
  vh.created_at
FROM videos_hot vh
WHERE vh.first_seen_at >= '2025-11-24'
ORDER BY vh.first_seen_at DESC
LIMIT 20;

