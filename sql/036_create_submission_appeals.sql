-- ============================================================================
-- CREATE CONTEST SUBMISSION APPEALS TABLE
-- ============================================================================
-- Allows users to appeal failed hashtag or description checks
-- Admins can review appeals and approve/deny them

CREATE TABLE IF NOT EXISTS contest_submission_appeals (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES contest_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appeal_type TEXT NOT NULL CHECK (appeal_type IN ('hashtag', 'description')),
  appeal_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_response TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate appeals for the same submission and type
  UNIQUE(submission_id, appeal_type)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contest_submission_appeals_submission_id 
  ON contest_submission_appeals(submission_id);
CREATE INDEX IF NOT EXISTS idx_contest_submission_appeals_user_id 
  ON contest_submission_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_submission_appeals_status 
  ON contest_submission_appeals(status);
CREATE INDEX IF NOT EXISTS idx_contest_submission_appeals_appeal_type 
  ON contest_submission_appeals(appeal_type);
CREATE INDEX IF NOT EXISTS idx_contest_submission_appeals_created_at 
  ON contest_submission_appeals(created_at DESC);

-- Enable RLS
ALTER TABLE contest_submission_appeals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can create and read their own appeals
DROP POLICY IF EXISTS "Users can create own appeals" ON contest_submission_appeals;
CREATE POLICY "Users can create own appeals" ON contest_submission_appeals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own appeals" ON contest_submission_appeals;
CREATE POLICY "Users can read own appeals" ON contest_submission_appeals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all appeals
DROP POLICY IF EXISTS "Admins can read all appeals" ON contest_submission_appeals;
CREATE POLICY "Admins can read all appeals" ON contest_submission_appeals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update appeals (approve/deny)
DROP POLICY IF EXISTS "Admins can update appeals" ON contest_submission_appeals;
CREATE POLICY "Admins can update appeals" ON contest_submission_appeals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE contest_submission_appeals IS 'Appeals for failed hashtag or description checks on contest submissions';
COMMENT ON COLUMN contest_submission_appeals.appeal_type IS 'Type of appeal: hashtag or description';
COMMENT ON COLUMN contest_submission_appeals.status IS 'Appeal status: pending, approved, or denied';
COMMENT ON COLUMN contest_submission_appeals.admin_response IS 'Optional response from admin when reviewing the appeal';

