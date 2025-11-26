-- ============================================================================
-- ADD STATS DISPLAY SETTING TO CONTESTS TABLE
-- ============================================================================
-- Adds display_stats column to control whether stats are shown on contest
-- submissions based on contest settings

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS display_stats BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN contests.display_stats IS 'Controls whether stats (views, likes, etc.) are displayed on contest submissions';

