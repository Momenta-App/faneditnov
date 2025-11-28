-- ============================================================================
-- ROLLBACK SCRIPT: Revert migrations 031-049
-- ============================================================================
-- This script rolls back the following migrations:
--   031: contest_submissions_video_hot_link.sql
--   032: bidirectional_video_stats_sync.sql
--   045: backfill_video_hot_ids.sql
--   046: add_cover_url_to_contest_submissions.sql
--   047: normalize_contest_submissions_to_videos_hot.sql
--   048: add_is_edit_index.sql
--   049: backfill_is_edit_flag.sql
--
-- This will restore contest_submissions to its original structure before
-- the video_hot_id normalization changes, and remove the is_edit column
-- from videos_hot if it was added.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: Remove triggers and functions from migration 032
-- ============================================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trigger_sync_contest_submissions_on_video_hot_update ON videos_hot;
DROP TRIGGER IF EXISTS trigger_sync_video_hot_on_submission_update ON contest_submissions;

-- Drop sync functions
DROP FUNCTION IF EXISTS sync_contest_submission_stats();
DROP FUNCTION IF EXISTS sync_video_hot_stats();

-- Drop backfill function from migration 045
DROP FUNCTION IF EXISTS backfill_submission_video_hot_id(INTEGER);

-- ============================================================================
-- PHASE 2: Restore columns that were dropped in migration 047
-- ============================================================================
-- If migration 047 was run, these columns need to be restored.
-- If migration 047 was NOT run, these will be no-ops (columns already exist).

-- Restore stats columns
ALTER TABLE contest_submissions 
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_updated_at TIMESTAMPTZ;

-- Restore video metadata columns
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS original_video_url TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Restore video_fingerprint (generated column)
-- Note: This depends on original_video_url, so restore that first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_submissions' 
    AND column_name = 'video_fingerprint'
  ) THEN
    -- Only add if original_video_url exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'contest_submissions' 
      AND column_name = 'original_video_url'
    ) THEN
      ALTER TABLE contest_submissions
      ADD COLUMN video_fingerprint TEXT GENERATED ALWAYS AS (md5(lower(original_video_url))) STORED;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: Remove video_hot_id column and related indexes (migration 031)
-- ============================================================================

-- Drop indexes that depend on video_hot_id first
DROP INDEX IF EXISTS idx_contest_submissions_video_hot_id;
DROP INDEX IF EXISTS idx_contest_submissions_contest_video_hot;

-- Drop the video_hot_id column
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS video_hot_id;

-- ============================================================================
-- PHASE 4: Restore indexes that were dropped in migration 047
-- ============================================================================

-- Restore impact score index (for ranking queries)
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_impact 
  ON contest_submissions(contest_id, impact_score DESC);

-- Restore fingerprint index (if video_fingerprint column exists)
CREATE INDEX IF NOT EXISTS idx_contest_submissions_fingerprint 
  ON contest_submissions(video_fingerprint)
  WHERE video_fingerprint IS NOT NULL;

-- Restore cover_url index (if cover_url column exists)
CREATE INDEX IF NOT EXISTS idx_contest_submissions_cover_url 
  ON contest_submissions(cover_url) 
  WHERE cover_url IS NOT NULL;

-- Restore original indexes from 020_contests_system.sql if they don't exist
CREATE INDEX IF NOT EXISTS idx_contest_submissions_impact_score 
  ON contest_submissions(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_platform 
  ON contest_submissions(platform);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_original_url 
  ON contest_submissions(original_video_url);

-- ============================================================================
-- PHASE 5: Restore constraints and defaults
-- ============================================================================

-- Restore NOT NULL constraint on original_video_url if it was dropped
-- Note: We check if column exists and has data first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_submissions' 
    AND column_name = 'original_video_url'
    AND is_nullable = 'YES'
  ) THEN
    -- Only make NOT NULL if all rows have values
    IF NOT EXISTS (
      SELECT 1 FROM contest_submissions 
      WHERE original_video_url IS NULL
      LIMIT 1
    ) THEN
      ALTER TABLE contest_submissions 
      ALTER COLUMN original_video_url SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Restore NOT NULL constraint on platform if it was dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_submissions' 
    AND column_name = 'platform'
    AND is_nullable = 'YES'
  ) THEN
    -- Only make NOT NULL if all rows have values
    IF NOT EXISTS (
      SELECT 1 FROM contest_submissions 
      WHERE platform IS NULL
      LIMIT 1
    ) THEN
      ALTER TABLE contest_submissions 
      ALTER COLUMN platform SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Restore UNIQUE constraint on (contest_id, user_id, original_video_url)
-- This should already exist, but ensure it's there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contest_submissions_contest_id_user_id_original_video_url_key'
  ) THEN
    ALTER TABLE contest_submissions
    ADD CONSTRAINT contest_submissions_contest_id_user_id_original_video_url_key
    UNIQUE(contest_id, user_id, original_video_url);
  END IF;
END $$;

-- ============================================================================
-- PHASE 6: Rollback migrations 048-049 (is_edit column)
-- ============================================================================
-- These migrations added is_edit column to videos_hot and backfilled it.
-- Since we're reverting the ingestion function that uses is_edit, we should
-- remove the column and index. However, if is_edit was added in an earlier
-- migration, we'll only remove the index added in 048.

-- Drop the index added in migration 048
DROP INDEX IF EXISTS idx_videos_hot_is_edit;

-- Note: We're NOT dropping the is_edit column itself because:
-- 1. It might have been added in an earlier migration
-- 2. The previous ingestion function doesn't use it, so it won't cause issues
-- 3. If you want to completely remove it, uncomment the line below:
-- ALTER TABLE videos_hot DROP COLUMN IF EXISTS is_edit;

-- ============================================================================
-- PHASE 7: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN contest_submissions.views_count IS 'View count for the video';
COMMENT ON COLUMN contest_submissions.likes_count IS 'Like count for the video';
COMMENT ON COLUMN contest_submissions.comments_count IS 'Comment count for the video';
COMMENT ON COLUMN contest_submissions.shares_count IS 'Share count for the video';
COMMENT ON COLUMN contest_submissions.saves_count IS 'Save/bookmark count for the video';
COMMENT ON COLUMN contest_submissions.impact_score IS 'Computed impact score via compute_impact() function';
COMMENT ON COLUMN contest_submissions.stats_updated_at IS 'Timestamp when stats were last updated';
COMMENT ON COLUMN contest_submissions.original_video_url IS 'Original URL of the submitted video';
COMMENT ON COLUMN contest_submissions.platform IS 'Platform: youtube, tiktok, or instagram';
COMMENT ON COLUMN contest_submissions.video_id IS 'Extracted video ID from URL';
COMMENT ON COLUMN contest_submissions.cover_url IS 'Cover image URL for the video';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after the rollback to verify the structure:

-- Check that video_hot_id is gone:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'contest_submissions' AND column_name = 'video_hot_id';
-- Should return 0 rows

-- Check that original columns are restored:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'contest_submissions' 
-- AND column_name IN ('original_video_url', 'platform', 'video_id', 'views_count', 'likes_count', 'impact_score')
-- ORDER BY column_name;

-- Check that triggers are gone:
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'contest_submissions' 
-- AND trigger_name LIKE '%sync%';
-- Should return 0 rows

-- Check that functions are gone:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('sync_contest_submission_stats', 'sync_video_hot_stats', 'backfill_submission_video_hot_id');
-- Should return 0 rows

-- Check that is_edit index is gone (column may still exist):
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'videos_hot' AND indexname = 'idx_videos_hot_is_edit';
-- Should return 0 rows

