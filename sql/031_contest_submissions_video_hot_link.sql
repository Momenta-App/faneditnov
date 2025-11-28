-- ============================================================================
-- MIGRATION: Add video_hot_id Foreign Key to contest_submissions
-- ============================================================================
-- This migration adds a foreign key relationship between contest_submissions
-- and videos_hot to enable data synchronization and enriched queries.
-- ============================================================================

-- Add video_hot_id column if it doesn't exist
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS video_hot_id TEXT REFERENCES videos_hot(video_id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contest_submissions_video_hot_id 
  ON contest_submissions(video_hot_id) 
  WHERE video_hot_id IS NOT NULL;

-- Composite index for contest + video_hot lookups
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_video_hot 
  ON contest_submissions(contest_id, video_hot_id) 
  WHERE video_hot_id IS NOT NULL;

-- Index for ranking queries with impact_score
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_impact 
  ON contest_submissions(contest_id, impact_score DESC);

COMMENT ON COLUMN contest_submissions.video_hot_id IS 'Foreign key to videos_hot table for data synchronization and enriched queries';

