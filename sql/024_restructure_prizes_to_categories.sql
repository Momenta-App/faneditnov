-- ============================================================================
-- RESTRUCTURE PRIZES TO CATEGORIES
-- ============================================================================
-- This migration restructures the contest system so that:
-- 1. Prizes belong to categories (not contests directly)
-- 2. Submissions can be linked to categories
-- 3. Campaign total is calculated from all prizes across all categories
-- ============================================================================

-- ============================================================================
-- PART 1: MIGRATE EXISTING DATA
-- ============================================================================
-- For existing contests with prizes but no categories, create a default category
-- and move prizes to it

DO $$
DECLARE
  contest_record RECORD;
  default_category_id UUID;
BEGIN
  -- Find contests that have prizes but no categories
  FOR contest_record IN
    SELECT DISTINCT c.id, c.title
    FROM contests c
    WHERE EXISTS (
      SELECT 1 FROM contest_prizes cp WHERE cp.contest_id = c.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM contest_categories cc WHERE cc.contest_id = c.id
    )
  LOOP
    -- Create a default category for this contest
    INSERT INTO contest_categories (contest_id, name, description, display_order)
    VALUES (contest_record.id, 'Main Category', 'Default category for existing prizes', 1)
    RETURNING id INTO default_category_id;

    -- Move all prizes from contest to this category
    UPDATE contest_prizes
    SET category_id = default_category_id
    WHERE contest_id = contest_record.id
    AND category_id IS NULL; -- Only update if not already set
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: MODIFY CONTEST_PRIZES TABLE
-- ============================================================================

-- Add category_id column (nullable initially for migration)
ALTER TABLE contest_prizes
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES contest_categories(id) ON DELETE CASCADE;

-- Migrate existing prizes to categories (if not already done)
UPDATE contest_prizes cp
SET category_id = (
  SELECT cc.id
  FROM contest_categories cc
  WHERE cc.contest_id = cp.contest_id
  ORDER BY cc.display_order
  LIMIT 1
)
WHERE cp.category_id IS NULL
AND EXISTS (
  SELECT 1 FROM contest_categories cc WHERE cc.contest_id = cp.contest_id
);

-- Make category_id NOT NULL after migration
ALTER TABLE contest_prizes
  ALTER COLUMN category_id SET NOT NULL;

-- Remove old contest_id foreign key constraint and column
ALTER TABLE contest_prizes
  DROP CONSTRAINT IF EXISTS contest_prizes_contest_id_fkey;

-- Drop old index
DROP INDEX IF EXISTS idx_contest_prizes_contest_id;

-- Create new index on category_id
CREATE INDEX IF NOT EXISTS idx_contest_prizes_category_id ON contest_prizes(category_id);

-- Update rank_order index to use category_id
DROP INDEX IF EXISTS idx_contest_prizes_rank_order;
CREATE INDEX IF NOT EXISTS idx_contest_prizes_rank_order ON contest_prizes(category_id, rank_order);

-- ============================================================================
-- PART 3: UPDATE RLS POLICIES FOR CONTEST_PRIZES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Public can read contest prizes" ON contest_prizes;
DROP POLICY IF EXISTS "Admins can manage contest prizes" ON contest_prizes;

-- Public can read prizes (via category -> contest)
CREATE POLICY "Public can read contest prizes" ON contest_prizes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contest_categories cc
      WHERE cc.id = contest_prizes.category_id
    )
  );

-- Admins can manage prizes (via category -> contest)
CREATE POLICY "Admins can manage contest prizes" ON contest_prizes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contest_categories cc
      JOIN contests c ON c.id = cc.contest_id
      WHERE cc.id = contest_prizes.category_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_categories cc
      JOIN contests c ON c.id = cc.contest_id
      WHERE cc.id = contest_prizes.category_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================================
-- PART 4: MODIFY CONTEST_SUBMISSIONS TABLE
-- ============================================================================

-- Add category_id column (nullable - for contests without categories)
ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES contest_categories(id) ON DELETE SET NULL;

-- Create index on category_id
CREATE INDEX IF NOT EXISTS idx_contest_submissions_category_id ON contest_submissions(category_id) WHERE category_id IS NOT NULL;

-- Drop old unique constraint
ALTER TABLE contest_submissions
  DROP CONSTRAINT IF EXISTS contest_submissions_contest_id_user_id_original_video_url_key;

-- Create new unique constraint that includes category_id
-- This allows same video to be submitted to different categories, but not same category twice
-- Use a partial unique index to handle NULL category_id (contests without categories)
CREATE UNIQUE INDEX IF NOT EXISTS contest_submissions_unique_per_category_with_null
  ON contest_submissions(contest_id, user_id, original_video_url)
  WHERE category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contest_submissions_unique_per_category_with_value
  ON contest_submissions(contest_id, category_id, user_id, original_video_url)
  WHERE category_id IS NOT NULL;

-- ============================================================================
-- PART 5: CREATE FUNCTION TO CALCULATE TOTAL PRIZE POOL
-- ============================================================================

CREATE OR REPLACE FUNCTION get_contest_total_prize_pool(p_contest_id UUID)
RETURNS DECIMAL(10,2) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(payout_amount)
     FROM contest_prizes cp
     JOIN contest_categories cc ON cp.category_id = cc.id
     WHERE cc.contest_id = p_contest_id),
    0
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_contest_total_prize_pool IS 
'Calculates the total prize pool for a contest by summing all prize amounts across all categories';

-- ============================================================================
-- PART 6: REMOVE OLD CONTEST_ID COLUMN FROM CONTEST_PRIZES
-- ============================================================================

-- Remove the contest_id column (after ensuring all data is migrated)
ALTER TABLE contest_prizes
  DROP COLUMN IF EXISTS contest_id;

-- ============================================================================
-- PART 7: COMMENTS
-- ============================================================================

COMMENT ON COLUMN contest_prizes.category_id IS 'Category this prize belongs to (prizes are now organized by category)';
COMMENT ON COLUMN contest_submissions.category_id IS 'Category this submission is for (nullable if contest has no categories)';

