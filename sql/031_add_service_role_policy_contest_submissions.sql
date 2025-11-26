-- Migration: Add service role policy for contest_submissions
-- This ensures service role (used by admin client) can read all submissions
-- Service role should bypass RLS, but this policy ensures reads work correctly

-- Service role can read all submissions (for admin operations)
DROP POLICY IF EXISTS "Service role can read all contest submissions" ON contest_submissions;
CREATE POLICY "Service role can read all contest submissions" ON contest_submissions
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Service role can update all submissions (for admin operations)
DROP POLICY IF EXISTS "Service role can update all contest submissions" ON contest_submissions;
CREATE POLICY "Service role can update all contest submissions" ON contest_submissions
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON POLICY "Service role can read all contest submissions" ON contest_submissions IS 'Allows service role to read all submissions for admin operations';
COMMENT ON POLICY "Service role can update all contest submissions" ON contest_submissions IS 'Allows service role to update all submissions for admin operations';

