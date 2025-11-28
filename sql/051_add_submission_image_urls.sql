-- ============================================================================
-- MIGRATION: Add cover_image_url and creator_avatar_url to contest_submissions
-- ============================================================================
-- This migration adds image URL columns to contest_submissions table.
-- These images are stored in Supabase storage (brightdata-results bucket)
-- during submission processing, before normal ingestion.
-- ============================================================================

-- Add cover_image_url column to contest_submissions
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add creator_avatar_url column to contest_submissions
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS creator_avatar_url TEXT;

-- Create indexes for image URL lookups
CREATE INDEX IF NOT EXISTS idx_contest_submissions_cover_image_url 
  ON contest_submissions(cover_image_url) 
  WHERE cover_image_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contest_submissions_creator_avatar_url 
  ON contest_submissions(creator_avatar_url) 
  WHERE creator_avatar_url IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN contest_submissions.cover_image_url IS 'Cover image URL for the video, stored in brightdata-results bucket before ingestion';
COMMENT ON COLUMN contest_submissions.creator_avatar_url IS 'Creator avatar image URL, stored in brightdata-results bucket before ingestion';

