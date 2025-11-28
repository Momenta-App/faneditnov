-- ============================================================================
-- MIGRATION: Create Contest User Access Table
-- ============================================================================
-- This migration creates a table to track which users have accessed
-- private contests via direct links. Once a user accesses a private contest,
-- they gain permanent access to it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contest_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only have one access record per contest
  UNIQUE(contest_id, user_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contest_user_access_contest_id ON contest_user_access(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_user_access_user_id ON contest_user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_user_access_accessed_at ON contest_user_access(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_contest_user_access_contest_user ON contest_user_access(contest_id, user_id);

-- Enable RLS
ALTER TABLE contest_user_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own access records
DROP POLICY IF EXISTS "Users can read own contest access" ON contest_user_access;
CREATE POLICY "Users can read own contest access" ON contest_user_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all access records
DROP POLICY IF EXISTS "Admins can read all contest access" ON contest_user_access;
CREATE POLICY "Admins can read all contest access" ON contest_user_access
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own access records (when accessing private contest)
DROP POLICY IF EXISTS "Users can insert own contest access" ON contest_user_access;
CREATE POLICY "Users can insert own contest access" ON contest_user_access
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all access records (for API endpoints)
-- Note: API endpoints using service role will bypass RLS

-- Trigger for updated_at (if we add it later)
-- For now, accessed_at is set on insert and doesn't need updating

COMMENT ON TABLE contest_user_access IS 'Tracks which users have accessed private contests via direct links';
COMMENT ON COLUMN contest_user_access.accessed_at IS 'Timestamp when user first accessed the private contest';

