-- Check BrightData configuration and recent activity

-- This query can't check API keys, but we can check:
-- 1. If submissions are being created (they are)
-- 2. If any have been processed (they haven't)

-- Summary of the issue:
SELECT 
  'Total pending submissions' as metric,
  COUNT(*)::text as value
FROM submission_metadata
WHERE snapshot_id LIKE 'pending_%'
UNION ALL
SELECT 
  'Pending older than 1 hour' as metric,
  COUNT(*)::text as value
FROM submission_metadata
WHERE snapshot_id LIKE 'pending_%'
  AND created_at < NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'Processed in last 24 hours' as metric,
  COUNT(*)::text as value
FROM submission_metadata
WHERE snapshot_id NOT LIKE 'pending_%'
  AND created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Bypass uploads pending' as metric,
  COUNT(*)::text as value
FROM submission_metadata
WHERE snapshot_id LIKE 'pending_%'
  AND skip_validation = true;

