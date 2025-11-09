-- ============================================================================
-- SUBMISSION METADATA TABLE
-- Stores temporary metadata for video submissions (e.g., skip_validation flag)
-- Used to pass context from trigger API to webhook processing
-- ============================================================================

-- Create submission_metadata table
CREATE TABLE IF NOT EXISTS submission_metadata (
  snapshot_id TEXT PRIMARY KEY,
  video_urls TEXT[], -- Store URLs for lookup since snapshot_id may change
  skip_validation BOOLEAN DEFAULT FALSE,
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_submission_metadata_created 
  ON submission_metadata(created_at);

CREATE INDEX IF NOT EXISTS idx_submission_metadata_urls
  ON submission_metadata USING GIN(video_urls);

-- Index for user lookups (audit purposes)
CREATE INDEX IF NOT EXISTS idx_submission_metadata_user 
  ON submission_metadata(submitted_by);

-- Enable RLS
ALTER TABLE submission_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS submission_metadata_insert_policy ON submission_metadata;
DROP POLICY IF EXISTS submission_metadata_service_policy ON submission_metadata;

-- Policy: Only authenticated users can insert their own metadata
CREATE POLICY submission_metadata_insert_policy ON submission_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Policy: Service role can do anything (for webhook processing)
CREATE POLICY submission_metadata_service_policy ON submission_metadata
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- CLEANUP FUNCTION
-- Automatically delete metadata older than 7 days to prevent table bloat
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_submission_metadata()
RETURNS void AS $$
BEGIN
  DELETE FROM submission_metadata 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned up submission_metadata older than 7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_submission_metadata IS 'Delete submission metadata older than 7 days (run periodically)';

-- ============================================================================
-- SCHEDULED CLEANUP (Optional - requires pg_cron extension)
-- Uncomment if you want automatic cleanup
-- ============================================================================

-- SELECT cron.schedule(
--   'cleanup-submission-metadata',
--   '0 2 * * *',  -- Run daily at 2 AM
--   'SELECT cleanup_old_submission_metadata();'
-- );

COMMENT ON TABLE submission_metadata IS 'Temporary storage for submission context (e.g., validation bypass flags). Auto-cleaned after 7 days.';

