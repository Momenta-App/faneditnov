-- Diagnostic queries to find out why uploads aren't working
-- Safe version that doesn't require bd_ingestions table

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

-- 3. Check for videos added in the last 10 minutes
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

-- 4. Check if is_edit column exists and has correct default
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'videos_hot' 
  AND column_name = 'is_edit';

-- 5. Check recent raw_video_assets (shows MP4 uploads)
SELECT 
  id,
  submission_metadata_id,
  contest_submission_id,
  standardized_url,
  created_at
FROM raw_video_assets
ORDER BY created_at DESC
LIMIT 10;

-- 6. Cross-reference: Check if submission_metadata exists but no video was created
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

