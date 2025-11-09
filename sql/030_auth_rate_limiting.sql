-- ============================================================================
-- AUTH RATE LIMITING TABLE
-- Tracks IP-based authentication attempts for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'signup', 'password-reset', 'forgot-password')),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ip_action_created 
  ON auth_rate_limits(ip_address, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_created_at 
  ON auth_rate_limits(created_at);

-- Enable RLS (though service role will access this)
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: No direct user access (only service role via API)
DROP POLICY IF EXISTS "Service role only" ON auth_rate_limits;
CREATE POLICY "Service role only" ON auth_rate_limits
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function: Delete old records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_auth_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_rate_limits
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE auth_rate_limits IS 'IP-based rate limiting for authentication attempts';
COMMENT ON COLUMN auth_rate_limits.ip_address IS 'Client IP address for rate limiting';
COMMENT ON COLUMN auth_rate_limits.action IS 'Type of authentication action: login, signup, password-reset, or forgot-password';
COMMENT ON COLUMN auth_rate_limits.success IS 'Whether the authentication attempt was successful';
COMMENT ON COLUMN auth_rate_limits.created_at IS 'Timestamp when the attempt was made';

