-- ============================================================================
-- GENERAL CATEGORIES AND STAT-BASED RANKING
-- ============================================================================
-- This migration adds:
-- 1. General categories (auto-entry for all submissions)
-- 2. Stat-based ranking methods for categories
-- 3. Many-to-many relationship between submissions and categories
-- ============================================================================

-- ============================================================================
-- PART 1: MODIFY CONTEST_CATEGORIES TABLE
-- ============================================================================

-- Add is_general column
ALTER TABLE contest_categories
  ADD COLUMN IF NOT EXISTS is_general BOOLEAN NOT NULL DEFAULT FALSE;

-- Add ranking_method column
ALTER TABLE contest_categories
  ADD COLUMN IF NOT EXISTS ranking_method TEXT NOT NULL DEFAULT 'manual'
  CHECK (ranking_method IN ('manual', 'views', 'likes', 'comments', 'shares', 'impact_score'));

-- Create index on is_general for efficient queries
CREATE INDEX IF NOT EXISTS idx_contest_categories_is_general ON contest_categories(contest_id, is_general) WHERE is_general = TRUE;

-- Create index on ranking_method
CREATE INDEX IF NOT EXISTS idx_contest_categories_ranking_method ON contest_categories(ranking_method);

-- ============================================================================
-- PART 2: CREATE CONTEST_SUBMISSION_CATEGORIES JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contest_submission_categories (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES contest_submissions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES contest_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- true for user-selected category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, category_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contest_submission_categories_submission_id ON contest_submission_categories(submission_id);
CREATE INDEX IF NOT EXISTS idx_contest_submission_categories_category_id ON contest_submission_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_contest_submission_categories_is_primary ON contest_submission_categories(submission_id, is_primary) WHERE is_primary = TRUE;

-- Enable RLS for contest_submission_categories
ALTER TABLE contest_submission_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contest_submission_categories
-- Users can read their own submission categories
DROP POLICY IF EXISTS "Users can read own submission categories" ON contest_submission_categories;
CREATE POLICY "Users can read own submission categories" ON contest_submission_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contest_submissions cs
      WHERE cs.id = contest_submission_categories.submission_id
      AND cs.user_id = auth.uid()
    )
  );

-- Public can read categories for approved submissions
DROP POLICY IF EXISTS "Public can read approved submission categories" ON contest_submission_categories;
CREATE POLICY "Public can read approved submission categories" ON contest_submission_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contest_submissions cs
      WHERE cs.id = contest_submission_categories.submission_id
      AND cs.content_review_status = 'approved'
      AND cs.processing_status = 'approved'
    )
  );

-- Admins can read all submission categories
DROP POLICY IF EXISTS "Admins can read all submission categories" ON contest_submission_categories;
CREATE POLICY "Admins can read all submission categories" ON contest_submission_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System can insert (via triggers/functions)
DROP POLICY IF EXISTS "System can insert submission categories" ON contest_submission_categories;
CREATE POLICY "System can insert submission categories" ON contest_submission_categories
  FOR INSERT
  WITH CHECK (true); -- Triggers will handle validation

-- ============================================================================
-- PART 3: CREATE FUNCTION TO AUTO-ASSIGN GENERAL CATEGORIES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_assign_general_categories(p_submission_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Insert all general categories for this submission's contest
  INSERT INTO contest_submission_categories (submission_id, category_id, is_primary)
  SELECT 
    p_submission_id,
    cc.id,
    FALSE
  FROM contest_categories cc
  JOIN contest_submissions cs ON cs.contest_id = cc.contest_id
  WHERE cs.id = p_submission_id
    AND cc.is_general = TRUE
  ON CONFLICT (submission_id, category_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_assign_general_categories IS 
'Auto-assigns all general categories to a submission';

-- ============================================================================
-- PART 4: CREATE TRIGGER TO AUTO-ASSIGN CATEGORIES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_assign_general_categories()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign all general categories automatically
  PERFORM auto_assign_general_categories(NEW.id);
  
  -- Also insert primary category if user selected one
  IF NEW.category_id IS NOT NULL THEN
    INSERT INTO contest_submission_categories (submission_id, category_id, is_primary)
    VALUES (NEW.id, NEW.category_id, TRUE)
    ON CONFLICT (submission_id, category_id) DO UPDATE SET is_primary = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_assign_general_categories ON contest_submissions;
CREATE TRIGGER trg_auto_assign_general_categories
  AFTER INSERT ON contest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_general_categories();

-- ============================================================================
-- PART 5: MIGRATE EXISTING DATA
-- ============================================================================
-- For existing submissions with category_id, create junction table entries

INSERT INTO contest_submission_categories (submission_id, category_id, is_primary)
SELECT id, category_id, TRUE
FROM contest_submissions
WHERE category_id IS NOT NULL
ON CONFLICT (submission_id, category_id) DO NOTHING;

-- For existing submissions, also assign general categories if they exist
DO $$
DECLARE
  submission_record RECORD;
BEGIN
  FOR submission_record IN
    SELECT id, contest_id
    FROM contest_submissions
  LOOP
    PERFORM auto_assign_general_categories(submission_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- PART 6: COMMENTS
-- ============================================================================

COMMENT ON COLUMN contest_categories.is_general IS 'If true, all submissions automatically enter this category';
COMMENT ON COLUMN contest_categories.ranking_method IS 'How this category is ranked: manual, views, likes, comments, shares, or impact_score';
COMMENT ON TABLE contest_submission_categories IS 'Many-to-many relationship between submissions and categories (supports multiple category membership)';
COMMENT ON COLUMN contest_submission_categories.is_primary IS 'True if this is the user-selected category, false if auto-assigned general category';

