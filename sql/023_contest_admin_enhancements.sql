-- Enhances contest admin experience with additional controls and metadata
-- 1. Adds submission rule + impact metric columns to contests
-- 2. Introduces contest_categories table for optional per-contest categories

-- ============================================================================
-- PART 1: CONTESTS TABLE ADDITIONS
-- ============================================================================
ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS allow_multiple_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS force_single_category BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_social_verification BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_mp4_upload BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_submissions_visibility TEXT NOT NULL DEFAULT 'public_hide_metrics'
    CHECK (public_submissions_visibility IN ('public_hide_metrics', 'public_with_rankings', 'private_judges_only')),
  ADD COLUMN IF NOT EXISTS impact_metric_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS impact_metric_explanation TEXT DEFAULT
    'Impact measures overall engagement including views, likes, comments and saves. It favors consistent engagement rather than one time spikes.';

UPDATE contests
SET impact_metric_explanation = 'Impact measures overall engagement including views, likes, comments and saves. It favors consistent engagement rather than one time spikes.'
WHERE impact_metric_explanation IS NULL;

-- ============================================================================
-- PART 2: CONTEST CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contest_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_categories_contest_id ON contest_categories(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_categories_display_order ON contest_categories(contest_id, display_order);

ALTER TABLE contest_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read contest categories" ON contest_categories;
CREATE POLICY "Public can read contest categories" ON contest_categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage contest categories" ON contest_categories;
CREATE POLICY "Admins can manage contest categories" ON contest_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_contest_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contest_categories_updated_at ON contest_categories;
CREATE TRIGGER trigger_contest_categories_updated_at
  BEFORE UPDATE ON contest_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_categories_updated_at();

