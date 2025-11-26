-- Migration: Add snapshot_id to contest_submissions for webhook matching
-- This allows the webhook to match BrightData responses to specific submissions

-- Add snapshot_id column if it doesn't exist
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS snapshot_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contest_submissions_snapshot_id 
  ON contest_submissions(snapshot_id) 
  WHERE snapshot_id IS NOT NULL;

COMMENT ON COLUMN contest_submissions.snapshot_id IS 'BrightData snapshot ID for matching webhook responses to submissions';

