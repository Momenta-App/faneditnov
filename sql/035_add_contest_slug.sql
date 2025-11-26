-- ============================================================================
-- ADD SLUG COLUMN TO CONTESTS TABLE
-- ============================================================================
-- Adds slug column to contests table for friendly URLs
-- Allows contests to be accessed via /contests/killbill instead of UUIDs

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add unique constraint on slug (nullable for backward compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contests_slug_unique ON contests(slug) WHERE slug IS NOT NULL;

-- Add index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_contests_slug ON contests(slug) WHERE slug IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contests.slug IS 'URL-friendly identifier for the contest (e.g., "killbill"). Must be unique and contain only lowercase alphanumeric characters and hyphens.';

