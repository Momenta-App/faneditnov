-- Migration: Add BrightData metadata columns to contest_submissions
-- Stores the actual description and hashtags from BrightData for reference

-- Add description_text column to store the actual description/caption from BrightData
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS description_text TEXT;

-- Add hashtags_array column to store the actual hashtags extracted from BrightData
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS hashtags_array TEXT[];

-- Add index for hashtags array searches (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_contest_submissions_hashtags_array 
  ON contest_submissions USING GIN(hashtags_array)
  WHERE hashtags_array IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN contest_submissions.description_text IS 'Actual description/caption text from BrightData';
COMMENT ON COLUMN contest_submissions.hashtags_array IS 'Array of hashtags extracted from BrightData';

