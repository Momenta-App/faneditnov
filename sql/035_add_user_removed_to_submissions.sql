-- ============================================================================
-- ADD USER_REMOVED FLAG TO CONTEST_SUBMISSIONS TABLE
-- ============================================================================
-- Adds user_removed column to allow soft deletion of submissions from user view
-- while preserving the submission data for contest statistics

ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS user_removed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_contest_submissions_user_removed 
  ON contest_submissions(user_removed) 
  WHERE user_removed = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN contest_submissions.user_removed IS 'When TRUE, submission is hidden from user view but still counted in contest stats';

-- Update RLS policy to exclude removed submissions from user's own view
-- Note: The existing policy "Users can read own submissions" will automatically
-- exclude removed submissions when we filter by user_removed = false in the API
-- No policy change needed as we handle filtering at the application level

