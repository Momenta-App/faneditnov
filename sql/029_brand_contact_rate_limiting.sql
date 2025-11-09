-- ============================================================================
-- BRAND CONTACT SUBMISSIONS TABLE
-- Tracks IP-based submissions for rate limiting bot protection
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_brand_contact_ip_created 
  ON brand_contact_submissions(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_contact_created_at 
  ON brand_contact_submissions(created_at);

-- Enable RLS (though service role will access this)
ALTER TABLE brand_contact_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: No direct user access (only service role via API)
DROP POLICY IF EXISTS "Service role only" ON brand_contact_submissions;
CREATE POLICY "Service role only" ON brand_contact_submissions
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function: Delete old records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_brand_contact_submissions()
RETURNS void AS $$
BEGIN
  DELETE FROM brand_contact_submissions
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE brand_contact_submissions IS 'IP-based rate limiting for brand contact form submissions';
COMMENT ON COLUMN brand_contact_submissions.ip_address IS 'Client IP address for rate limiting';
COMMENT ON COLUMN brand_contact_submissions.created_at IS 'Timestamp when submission was made';

