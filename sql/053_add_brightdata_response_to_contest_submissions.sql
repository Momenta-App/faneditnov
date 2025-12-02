-- ============================================================================
-- MIGRATION: Add brightdata_response to contest_submissions
-- ============================================================================
-- This migration adds a column to store the raw BrightData response for debugging
-- and verification purposes.
-- ============================================================================

-- Add brightdata_response column to contest_submissions
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS brightdata_response JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN contest_submissions.brightdata_response IS 'Raw BrightData API response stored for debugging and verification of stats extraction';

