-- Migration: Add Missing Tables and Columns
-- This migration adds:
-- 1. creators_cold table (for cold storage of creator full JSON)
-- 2. hashtags_cold table (for cold storage of hashtag data)
-- 3. total_play_count column to creators_hot table

-- ============================================================================
-- ADD TOTAL_PLAY_COUNT TO CREATORS_HOT
-- ============================================================================

ALTER TABLE creators_hot 
ADD COLUMN IF NOT EXISTS total_play_count BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creators_total_play_count ON creators_hot(total_play_count DESC);

COMMENT ON COLUMN creators_hot.total_play_count IS 'Total views across all creator videos';

-- ============================================================================
-- CREATORS_COLD
-- Cold storage for complete creator profile data
-- ============================================================================

CREATE TABLE IF NOT EXISTS creators_cold (
  creator_id TEXT PRIMARY KEY REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  full_json JSONB NOT NULL,
  raw_data JSONB,
  platform_identities JSONB, -- Cross-platform handles (TikTok, Instagram, YouTube, etc.)
  tags JSONB,
  labels JSONB,
  insights JSONB, -- Analytics insights
  engagement_metrics JSONB, -- Engagement rate, audience demographics, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for creators_cold
CREATE INDEX IF NOT EXISTS idx_creators_cold_full_json ON creators_cold USING GIN(full_json);
CREATE INDEX IF NOT EXISTS idx_creators_cold_platform_identities ON creators_cold USING GIN(platform_identities);
CREATE INDEX IF NOT EXISTS idx_creators_cold_updated_at ON creators_cold(updated_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION update_creators_cold_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creators_cold_updated_at
  BEFORE UPDATE ON creators_cold
  FOR EACH ROW
  EXECUTE FUNCTION update_creators_cold_updated_at();

-- RLS Policies
ALTER TABLE creators_cold ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON creators_cold FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON creators_cold 
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE creators_cold IS 'Cold storage for complete creator profile data and raw JSON';

-- ============================================================================
-- HASHTAGS_COLD
-- Cold storage for hashtag metadata and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS hashtags_cold (
  hashtag TEXT PRIMARY KEY REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  full_json JSONB,
  raw_data JSONB,
  related_hashtags TEXT[], -- Array of related hashtag IDs
  trending_history JSONB, -- Historical trending data
  usage_stats JSONB, -- Detailed usage statistics
  content_categories JSONB, -- Categories this hashtag appears in
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for hashtags_cold
CREATE INDEX IF NOT EXISTS idx_hashtags_cold_full_json ON hashtags_cold USING GIN(full_json);
CREATE INDEX IF NOT EXISTS idx_hashtags_cold_related_hashtags ON hashtags_cold USING GIN(related_hashtags);
CREATE INDEX IF NOT EXISTS idx_hashtags_cold_updated_at ON hashtags_cold(updated_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION update_hashtags_cold_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hashtags_cold_updated_at
  BEFORE UPDATE ON hashtags_cold
  FOR EACH ROW
  EXECUTE FUNCTION update_hashtags_cold_updated_at();

-- RLS Policies
ALTER TABLE hashtags_cold ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON hashtags_cold FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON hashtags_cold 
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE hashtags_cold IS 'Cold storage for complete hashtag metadata and analytics';

