-- ============================================================================
-- MIGRATION: Update Contest Status and Add Visibility
-- ============================================================================
-- This migration:
-- 1. Updates status CHECK constraint to include 'ended' and 'draft'
-- 2. Changes existing 'closed' status to 'ended'
-- 3. Adds visibility column with 'open' and 'private_link_only' options
-- 4. Adds index on visibility column
-- ============================================================================

-- First, update existing 'closed' status to 'ended'
UPDATE contests
SET status = 'ended'
WHERE status = 'closed';

-- Drop the old CHECK constraint
ALTER TABLE contests
DROP CONSTRAINT IF EXISTS contests_status_check;

-- Add new CHECK constraint with updated status values
ALTER TABLE contests
ADD CONSTRAINT contests_status_check 
CHECK (status IN ('upcoming', 'live', 'ended', 'draft'));

-- Add visibility column
ALTER TABLE contests
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'open'
CHECK (visibility IN ('open', 'private_link_only'));

-- Add index on visibility for efficient filtering
CREATE INDEX IF NOT EXISTS idx_contests_visibility ON contests(visibility);

-- Add composite index for common queries (status + visibility)
CREATE INDEX IF NOT EXISTS idx_contests_status_visibility ON contests(status, visibility);

-- Comments for documentation
COMMENT ON COLUMN contests.status IS 'Contest status: upcoming (not started), live (active), ended (finished), draft (not published)';
COMMENT ON COLUMN contests.visibility IS 'Contest visibility: open (public) or private_link_only (requires access link)';

