-- ============================================================================
-- MIGRATION: Add cover_url to contest_submissions and sync from videos_hot
-- ============================================================================
-- This migration adds a cover_url column to contest_submissions and ensures
-- it is synchronized from videos_hot during ingestion and via triggers.
-- ============================================================================

-- Add cover_url column to contest_submissions
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Create index for cover_url lookups
CREATE INDEX IF NOT EXISTS idx_contest_submissions_cover_url 
  ON contest_submissions(cover_url) 
  WHERE cover_url IS NOT NULL;

COMMENT ON COLUMN contest_submissions.cover_url IS 'Cover image URL for the video, synced from videos_hot.cover_url during ingestion';

-- ============================================================================
-- Update bidirectional sync function to include cover_url
-- ============================================================================

-- Function to sync contest_submissions stats (including cover_url) when videos_hot is updated
CREATE OR REPLACE FUNCTION sync_contest_submission_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all contest_submissions that reference this video_hot_id
  UPDATE contest_submissions
  SET
    views_count = NEW.views_count,
    likes_count = NEW.likes_count,
    comments_count = NEW.comments_count,
    shares_count = NEW.shares_count,
    saves_count = NEW.collect_count,
    impact_score = NEW.impact_score,
    cover_url = NEW.cover_url,
    stats_updated_at = NOW(),
    updated_at = NOW()
  WHERE video_hot_id = NEW.video_id
    AND (
      -- Only update if stats actually changed to avoid unnecessary updates
      views_count IS DISTINCT FROM NEW.views_count OR
      likes_count IS DISTINCT FROM NEW.likes_count OR
      comments_count IS DISTINCT FROM NEW.comments_count OR
      shares_count IS DISTINCT FROM NEW.shares_count OR
      saves_count IS DISTINCT FROM NEW.collect_count OR
      impact_score IS DISTINCT FROM NEW.impact_score OR
      cover_url IS DISTINCT FROM NEW.cover_url
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to include cover_url in the sync
DROP TRIGGER IF EXISTS trigger_sync_contest_submissions_on_video_hot_update ON videos_hot;
CREATE TRIGGER trigger_sync_contest_submissions_on_video_hot_update
  AFTER UPDATE OF views_count, likes_count, comments_count, shares_count, collect_count, impact_score, cover_url
  ON videos_hot
  FOR EACH ROW
  WHEN (
    OLD.views_count IS DISTINCT FROM NEW.views_count OR
    OLD.likes_count IS DISTINCT FROM NEW.likes_count OR
    OLD.comments_count IS DISTINCT FROM NEW.comments_count OR
    OLD.shares_count IS DISTINCT FROM NEW.shares_count OR
    OLD.collect_count IS DISTINCT FROM NEW.collect_count OR
    OLD.impact_score IS DISTINCT FROM NEW.impact_score OR
    OLD.cover_url IS DISTINCT FROM NEW.cover_url
  )
  EXECUTE FUNCTION sync_contest_submission_stats();

COMMENT ON FUNCTION sync_contest_submission_stats() IS 'Syncs stats and cover_url from videos_hot to contest_submissions when videos_hot is updated';

