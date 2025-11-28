-- ============================================================================
-- MIGRATION: Bidirectional Video Stats Synchronization
-- ============================================================================
-- This migration creates triggers to keep stats synchronized between
-- videos_hot and contest_submissions tables bidirectionally.
-- ============================================================================

-- Function to sync contest_submissions stats when videos_hot is updated
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
      impact_score IS DISTINCT FROM NEW.impact_score
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync videos_hot stats when contest_submissions is updated
CREATE OR REPLACE FUNCTION sync_video_hot_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if video_hot_id is set
  IF NEW.video_hot_id IS NOT NULL THEN
    -- Update videos_hot with stats from contest_submissions
    UPDATE videos_hot
    SET
      views_count = NEW.views_count,
      likes_count = NEW.likes_count,
      comments_count = NEW.comments_count,
      shares_count = NEW.shares_count,
      collect_count = NEW.saves_count,
      impact_score = NEW.impact_score,
      last_seen_at = NOW(),
      updated_at = NOW()
    WHERE video_id = NEW.video_hot_id
      AND (
        -- Only update if stats actually changed
        views_count IS DISTINCT FROM NEW.views_count OR
        likes_count IS DISTINCT FROM NEW.likes_count OR
        comments_count IS DISTINCT FROM NEW.comments_count OR
        shares_count IS DISTINCT FROM NEW.shares_count OR
        collect_count IS DISTINCT FROM NEW.saves_count OR
        impact_score IS DISTINCT FROM NEW.impact_score
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on videos_hot to sync to contest_submissions
DROP TRIGGER IF EXISTS trigger_sync_contest_submissions_on_video_hot_update ON videos_hot;
CREATE TRIGGER trigger_sync_contest_submissions_on_video_hot_update
  AFTER UPDATE OF views_count, likes_count, comments_count, shares_count, collect_count, impact_score
  ON videos_hot
  FOR EACH ROW
  WHEN (
    OLD.views_count IS DISTINCT FROM NEW.views_count OR
    OLD.likes_count IS DISTINCT FROM NEW.likes_count OR
    OLD.comments_count IS DISTINCT FROM NEW.comments_count OR
    OLD.shares_count IS DISTINCT FROM NEW.shares_count OR
    OLD.collect_count IS DISTINCT FROM NEW.collect_count OR
    OLD.impact_score IS DISTINCT FROM NEW.impact_score
  )
  EXECUTE FUNCTION sync_contest_submission_stats();

-- Create trigger on contest_submissions to sync to videos_hot
DROP TRIGGER IF EXISTS trigger_sync_video_hot_on_submission_update ON contest_submissions;
CREATE TRIGGER trigger_sync_video_hot_on_submission_update
  AFTER UPDATE OF views_count, likes_count, comments_count, shares_count, saves_count, impact_score, video_hot_id
  ON contest_submissions
  FOR EACH ROW
  WHEN (
    NEW.video_hot_id IS NOT NULL AND (
      OLD.views_count IS DISTINCT FROM NEW.views_count OR
      OLD.likes_count IS DISTINCT FROM NEW.likes_count OR
      OLD.comments_count IS DISTINCT FROM NEW.comments_count OR
      OLD.shares_count IS DISTINCT FROM NEW.shares_count OR
      OLD.saves_count IS DISTINCT FROM NEW.saves_count OR
      OLD.impact_score IS DISTINCT FROM NEW.impact_score OR
      OLD.video_hot_id IS DISTINCT FROM NEW.video_hot_id
    )
  )
  EXECUTE FUNCTION sync_video_hot_stats();

COMMENT ON FUNCTION sync_contest_submission_stats() IS 'Syncs stats from videos_hot to contest_submissions when videos_hot is updated';
COMMENT ON FUNCTION sync_video_hot_stats() IS 'Syncs stats from contest_submissions to videos_hot when contest_submissions is updated';

