-- ============================================================================
-- BACKFILL IS_EDIT FLAG FOR EXISTING VIDEOS
-- ============================================================================
-- This migration backfills the is_edit flag for all existing videos in videos_hot
-- based on their hashtags, bypass status, and contest submission status
-- ============================================================================

-- Step 1: Set is_edit = TRUE for videos with edit hashtag
-- Check video_hashtag_facts for hashtags containing 'edit'
UPDATE public.videos_hot v
SET is_edit = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.video_hashtag_facts vhf
  WHERE vhf.video_id = v.video_id
    AND LOWER(vhf.hashtag) LIKE '%edit%'
);

-- Step 2: Set is_edit = TRUE for bypass uploads
-- Check submission_metadata for skip_validation = true
-- Note: We need to match by snapshot_id, but videos_hot doesn't have snapshot_id
-- So we'll check if video was uploaded via bypass by checking if it exists in
-- submission_metadata with skip_validation = true and matches the video URL
UPDATE public.videos_hot v
SET is_edit = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.submission_metadata sm
  WHERE sm.skip_validation = TRUE
    AND (
      v.url = ANY(sm.video_urls)
      OR v.video_url = ANY(sm.video_urls)
    )
)
AND v.is_edit IS DISTINCT FROM TRUE; -- Don't override if already set to TRUE

-- Step 3: Set is_edit = FALSE for contest submissions without edit hashtag
-- Find contest submissions via contest_submissions.video_hot_id
-- Check if video has edit hashtag in video_hashtag_facts
-- If no edit hashtag, set is_edit = FALSE
UPDATE public.videos_hot v
SET is_edit = FALSE
WHERE EXISTS (
  SELECT 1
  FROM public.contest_submissions cs
  WHERE cs.video_hot_id = v.video_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.video_hashtag_facts vhf
  WHERE vhf.video_id = v.video_id
    AND LOWER(vhf.hashtag) LIKE '%edit%'
)
AND v.is_edit IS DISTINCT FROM FALSE; -- Don't override if already set to FALSE

-- Step 4: Handle NULL values - set to FALSE if still NULL after all checks
-- This ensures backward compatibility
UPDATE public.videos_hot
SET is_edit = FALSE
WHERE is_edit IS NULL;

-- Report backfill results
DO $$
DECLARE
  total_videos INTEGER;
  edit_videos INTEGER;
  non_edit_videos INTEGER;
  null_videos INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_videos FROM public.videos_hot;
  SELECT COUNT(*) INTO edit_videos FROM public.videos_hot WHERE is_edit = TRUE;
  SELECT COUNT(*) INTO non_edit_videos FROM public.videos_hot WHERE is_edit = FALSE;
  SELECT COUNT(*) INTO null_videos FROM public.videos_hot WHERE is_edit IS NULL;
  
  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  Total videos: %', total_videos;
  RAISE NOTICE '  Edit videos (is_edit = TRUE): %', edit_videos;
  RAISE NOTICE '  Non-edit videos (is_edit = FALSE): %', non_edit_videos;
  RAISE NOTICE '  Videos with NULL is_edit: %', null_videos;
  
  IF null_videos > 0 THEN
    RAISE WARNING 'Some videos still have NULL is_edit flag. These should be set to FALSE.';
  END IF;
END $$;

COMMENT ON COLUMN public.videos_hot.is_edit IS 'Backfilled: Videos with edit hashtag marked as TRUE, contest submissions without edit hashtag marked as FALSE';

