-- ============================================================================
-- MIGRATION: Normalize contest_submissions to use videos_hot as single source of truth
-- ============================================================================
-- This migration:
-- 1. Backfills video_hot_id for all existing submissions
-- 2. Removes bidirectional sync triggers
-- 3. Drops redundant columns from contest_submissions
-- 4. Adds performance indexes
-- ============================================================================

-- ============================================================================
-- PHASE 1: Backfill video_hot_id for all existing submissions
-- ============================================================================

-- First, try matching by video_id + platform (most reliable)
DO $$
DECLARE
  matched_count INTEGER := 0;
BEGIN
  UPDATE contest_submissions cs
  SET video_hot_id = vh.video_id
  FROM videos_hot vh
  WHERE cs.video_hot_id IS NULL
    AND cs.video_id IS NOT NULL
    AND cs.video_id != ''
    AND cs.platform IS NOT NULL
    AND (
      vh.post_id = cs.video_id OR
      vh.video_id = cs.video_id
    )
    AND vh.platform = cs.platform;
  
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE 'Matched % submissions by video_id + platform', matched_count;
END $$;

-- Second, try matching by original_video_url (fallback)
DO $$
DECLARE
  matched_count INTEGER := 0;
BEGIN
  UPDATE contest_submissions cs
  SET video_hot_id = vh.video_id
  FROM videos_hot vh
  WHERE cs.video_hot_id IS NULL
    AND cs.original_video_url IS NOT NULL
    AND cs.original_video_url != ''
    AND (
      vh.url = cs.original_video_url OR
      vh.video_url = cs.original_video_url OR
      vh.url = regexp_replace(cs.original_video_url, '[?&#].*$', '') OR
      vh.video_url = regexp_replace(cs.original_video_url, '[?&#].*$', '')
    )
    AND vh.platform = cs.platform;
  
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE 'Matched % additional submissions by URL', matched_count;
END $$;

-- Report final status
DO $$
DECLARE
  total_submissions INTEGER;
  linked_submissions INTEGER;
  unlinked_submissions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_submissions FROM contest_submissions;
  SELECT COUNT(*) INTO linked_submissions FROM contest_submissions WHERE video_hot_id IS NOT NULL;
  SELECT COUNT(*) INTO unlinked_submissions FROM contest_submissions WHERE video_hot_id IS NULL;
  
  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  Total submissions: %', total_submissions;
  RAISE NOTICE '  Linked to videos_hot: %', linked_submissions;
  RAISE NOTICE '  Unlinked (need ingestion): %', unlinked_submissions;
  
  IF unlinked_submissions > 0 THEN
    RAISE WARNING 'Some submissions are not linked to videos_hot. These will need to be ingested or manually linked.';
  END IF;
END $$;

-- ============================================================================
-- PHASE 2: Remove bidirectional sync triggers and functions
-- ============================================================================

-- Drop triggers that depend on stats columns first
DROP TRIGGER IF EXISTS trigger_sync_contest_submissions_on_video_hot_update ON videos_hot;
DROP TRIGGER IF EXISTS trigger_sync_video_hot_on_submission_update ON contest_submissions;
DROP TRIGGER IF EXISTS trg_contest_submissions_set_impact ON contest_submissions;

-- Drop functions
DROP FUNCTION IF EXISTS sync_contest_submission_stats();
DROP FUNCTION IF EXISTS sync_video_hot_stats();
DROP FUNCTION IF EXISTS update_contest_submission_impact();

-- ============================================================================
-- PHASE 3: Drop redundant columns from contest_submissions
-- ============================================================================
-- These columns are now sourced from videos_hot via JOIN

-- Drop stats columns (now in videos_hot)
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS views_count;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS likes_count;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS comments_count;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS shares_count;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS saves_count;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS impact_score;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS stats_updated_at;

-- Drop video metadata columns (now in videos_hot)
-- Note: video_fingerprint is a generated column that depends on original_video_url, so drop it first
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS video_fingerprint;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS original_video_url;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS platform;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS video_id;
ALTER TABLE contest_submissions DROP COLUMN IF EXISTS cover_url;

-- Drop indexes that are no longer needed
DROP INDEX IF EXISTS idx_contest_submissions_cover_url;
DROP INDEX IF EXISTS idx_contest_submissions_contest_impact;
DROP INDEX IF EXISTS idx_contest_submissions_fingerprint;

-- ============================================================================
-- PHASE 4: Add performance indexes
-- ============================================================================

-- Ensure video_hot_id index exists (should already exist from migration 031)
CREATE INDEX IF NOT EXISTS idx_contest_submissions_video_hot_id 
  ON contest_submissions(video_hot_id) 
  WHERE video_hot_id IS NOT NULL;

-- Composite index for common query pattern: contest + video_hot lookups
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_video_hot 
  ON contest_submissions(contest_id, video_hot_id) 
  WHERE video_hot_id IS NOT NULL;

-- Index on videos_hot.video_url for linking (if not exists)
CREATE INDEX IF NOT EXISTS idx_videos_hot_video_url 
  ON videos_hot(video_url) 
  WHERE video_url IS NOT NULL;

-- Index on videos_hot.url for linking (if not exists)
CREATE INDEX IF NOT EXISTS idx_videos_hot_url 
  ON videos_hot(url) 
  WHERE url IS NOT NULL;

-- ============================================================================
-- PHASE 5: Add constraint to ensure video_hot_id is set for new submissions
-- ============================================================================
-- Note: We don't make it NOT NULL yet to allow for edge cases during transition
-- But we add a check constraint to warn if it's missing

COMMENT ON COLUMN contest_submissions.video_hot_id IS 
  'Foreign key to videos_hot table. All video stats and metadata should be retrieved from videos_hot via JOIN.';

-- ============================================================================
-- Verification queries (for manual checking)
-- ============================================================================

-- Uncomment to check for submissions without video_hot_id:
-- SELECT COUNT(*) as unlinked_count 
-- FROM contest_submissions 
-- WHERE video_hot_id IS NULL;

-- Uncomment to check for submissions with video_hot_id but missing videos_hot record:
-- SELECT cs.id, cs.video_hot_id 
-- FROM contest_submissions cs
-- LEFT JOIN videos_hot vh ON cs.video_hot_id = vh.video_id
-- WHERE cs.video_hot_id IS NOT NULL 
--   AND vh.video_id IS NULL;

