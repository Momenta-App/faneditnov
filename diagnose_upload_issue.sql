-- Diagnostic queries to find out why uploads aren't working

-- 1. Check if videos are being rejected (should show recent rejections)
SELECT 
  post_id,
  creator_id,
  tiktok_url as video_url,
  rejection_reason,
  rejected_at
FROM rejected_videos
ORDER BY rejected_at DESC
LIMIT 10;

-- 2. Check recent submission_metadata records (shows what was submitted)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  submitted_by,
  created_at
FROM submission_metadata
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check bd_ingestions table (shows ingestion attempts and errors)
-- NOTE: This table may not exist - uncomment after running sql/032_bd_ingestions_table.sql
/*
SELECT 
  snapshot_id,
  status,
  error,
  processed_count,
  raw_count,
  created_at,
  updated_at
FROM bd_ingestions
ORDER BY created_at DESC
LIMIT 10;
*/

-- 4. Check for videos added in the last 10 minutes
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
WHERE 
  COALESCE(first_seen_at, created_at, updated_at) >= NOW() - INTERVAL '10 minutes'
ORDER BY COALESCE(first_seen_at, created_at, updated_at) DESC;

-- 5. Check if is_edit column exists and has correct default
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'videos_hot' 
  AND column_name = 'is_edit';

-- 6. Check recent raw_video_assets (shows MP4 uploads)
SELECT 
  id,
  submission_metadata_id,
  contest_submission_id,
  video_url,
  platform,
  ownership_status,
  created_at
FROM raw_video_assets
ORDER BY created_at DESC
LIMIT 10;

-- 7. Cross-reference: Check if submission_metadata exists but no video was created
SELECT 
  sm.snapshot_id,
  sm.video_urls,
  sm.skip_validation,
  sm.created_at as metadata_created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = ANY(sm.video_urls)
    ) THEN 'Video exists'
    ELSE 'Video missing'
  END as video_status
FROM submission_metadata sm
WHERE sm.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY sm.created_at DESC
LIMIT 10;

-- NOTE: To see ingestion status/errors, run sql/032_bd_ingestions_table.sql first,
-- then uncomment the query below:
/*
SELECT 
  sm.snapshot_id,
  sm.video_urls,
  sm.skip_validation,
  sm.created_at as metadata_created_at,
  bi.status as ingestion_status,
  bi.error as ingestion_error,
  bi.processed_count,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = ANY(sm.video_urls)
    ) THEN 'Video exists'
    ELSE 'Video missing'
  END as video_status
FROM submission_metadata sm
LEFT JOIN bd_ingestions bi ON bi.snapshot_id = sm.snapshot_id
WHERE sm.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY sm.created_at DESC
LIMIT 10;
*/

