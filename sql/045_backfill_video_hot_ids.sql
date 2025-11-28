-- ============================================================================
-- MIGRATION: Backfill video_hot_id in contest_submissions
-- ============================================================================
-- This migration backfills the video_hot_id column by matching existing
-- contest_submissions records with videos_hot based on video_id + platform.
-- ============================================================================

-- Function to backfill video_hot_id for a single submission
CREATE OR REPLACE FUNCTION backfill_submission_video_hot_id(submission_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_video_id TEXT;
  v_platform TEXT;
  v_video_hot_id TEXT;
BEGIN
  -- Get video_id and platform from submission
  SELECT cs.video_id, cs.platform
  INTO v_video_id, v_platform
  FROM contest_submissions cs
  WHERE cs.id = submission_id;
  
  -- If no video_id, can't match
  IF v_video_id IS NULL OR v_video_id = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Try to find matching video in videos_hot
  -- Match by post_id (which is often the same as video_id) and platform
  SELECT vh.video_id
  INTO v_video_hot_id
  FROM videos_hot vh
  WHERE (
    vh.post_id = v_video_id OR
    vh.video_id = v_video_id
  )
  AND vh.platform = v_platform
  LIMIT 1;
  
  -- If found, update the submission
  IF v_video_hot_id IS NOT NULL THEN
    UPDATE contest_submissions
    SET video_hot_id = v_video_hot_id
    WHERE id = submission_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Backfill all existing submissions
DO $$
DECLARE
  submission RECORD;
  matched_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  -- Count total submissions
  SELECT COUNT(*) INTO total_count
  FROM contest_submissions
  WHERE video_hot_id IS NULL
    AND video_id IS NOT NULL
    AND video_id != '';
  
  RAISE NOTICE 'Starting backfill for % submissions', total_count;
  
  -- Process each submission
  FOR submission IN
    SELECT id, video_id, platform
    FROM contest_submissions
    WHERE video_hot_id IS NULL
      AND video_id IS NOT NULL
      AND video_id != ''
    ORDER BY id
  LOOP
    -- Try to match by post_id or video_id + platform using subquery
    UPDATE contest_submissions cs
    SET video_hot_id = (
      SELECT vh.video_id
      FROM videos_hot vh
      WHERE (
        vh.post_id = submission.video_id OR
        vh.video_id = submission.video_id
      )
      AND vh.platform = submission.platform
      AND vh.video_id IS NOT NULL
      LIMIT 1
    )
    WHERE cs.id = submission.id
      AND cs.video_hot_id IS NULL;
    
    IF FOUND THEN
      matched_count := matched_count + 1;
    END IF;
    
    -- Log progress every 100 records
    IF matched_count % 100 = 0 THEN
      RAISE NOTICE 'Matched % out of % processed submissions', matched_count, total_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: Matched % out of % submissions', matched_count, total_count;
END $$;

-- Also try matching by original_video_url if video_id didn't match
DO $$
DECLARE
  matched_count INTEGER := 0;
BEGIN
  -- Try to match by URL
  UPDATE contest_submissions cs
  SET video_hot_id = vh.video_id
  FROM videos_hot vh
  WHERE cs.video_hot_id IS NULL
    AND cs.original_video_url IS NOT NULL
    AND cs.original_video_url != ''
    AND (
      vh.url = cs.original_video_url OR
      vh.video_url = cs.original_video_url
    )
    AND vh.platform = cs.platform;
  
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE 'Matched % additional submissions by URL', matched_count;
END $$;

-- Cleanup function (optional, can be removed after backfill is complete)
-- DROP FUNCTION IF EXISTS backfill_submission_video_hot_id(INTEGER);

COMMENT ON FUNCTION backfill_submission_video_hot_id(INTEGER) IS 'Backfills video_hot_id for a single contest submission by matching video_id + platform';

