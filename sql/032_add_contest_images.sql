-- ============================================================================
-- ADD IMAGE FIELDS TO CONTESTS TABLE
-- ============================================================================
-- Adds profile_image_url and cover_image_url columns to contests table
-- for displaying contest branding similar to communities

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN contests.profile_image_url IS 'URL to the contest profile/logo image';
COMMENT ON COLUMN contests.cover_image_url IS 'URL to the contest cover/banner image';

