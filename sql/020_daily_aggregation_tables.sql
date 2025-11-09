-- Daily Aggregation Tables for Time-Based Rankings
-- These tables store daily metrics bucketed by video's original created_at date
-- Supports fast time-windowed queries (7d, 30d, year) regardless of ingestion order

-- ============================================================================
-- HASHTAG_DAILY_STATS
-- Daily aggregated metrics for hashtags
-- ============================================================================

CREATE TABLE IF NOT EXISTS hashtag_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Aggregate metrics for videos with created_at on this date
  videos_count INTEGER DEFAULT 0,
  creators_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  impact_score_total BIGINT DEFAULT 0,
  
  -- Tracking
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_hashtag_date UNIQUE(hashtag, date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hashtag_daily_hashtag_date ON hashtag_daily_stats(hashtag, date DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_daily_date ON hashtag_daily_stats(date DESC);

COMMENT ON TABLE hashtag_daily_stats IS 'Daily aggregated metrics for hashtags, bucketed by video created_at date';
COMMENT ON COLUMN hashtag_daily_stats.date IS 'Date from video created_at (not ingestion date)';
COMMENT ON COLUMN hashtag_daily_stats.videos_count IS 'Number of videos with this hashtag created on this date';
COMMENT ON COLUMN hashtag_daily_stats.creators_count IS 'Number of unique creators using this hashtag on this date';

-- ============================================================================
-- CREATOR_DAILY_STATS
-- Daily aggregated metrics for creators
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Aggregate metrics for videos created by this creator on this date
  videos_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  comments_total BIGINT DEFAULT 0,
  shares_total BIGINT DEFAULT 0,
  impact_score_total BIGINT DEFAULT 0,
  
  -- Tracking
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_creator_date UNIQUE(creator_id, date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_creator_daily_creator_date ON creator_daily_stats(creator_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_creator_daily_date ON creator_daily_stats(date DESC);

COMMENT ON TABLE creator_daily_stats IS 'Daily aggregated metrics for creators, bucketed by video created_at date';
COMMENT ON COLUMN creator_daily_stats.date IS 'Date from video created_at (not ingestion date)';
COMMENT ON COLUMN creator_daily_stats.videos_count IS 'Number of videos created by this creator on this date';

-- ============================================================================
-- SOUND_DAILY_STATS
-- Daily aggregated metrics for sounds
-- ============================================================================

CREATE TABLE IF NOT EXISTS sound_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_id TEXT NOT NULL REFERENCES sounds_hot(sound_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Aggregate metrics for videos using this sound on this date
  videos_count INTEGER DEFAULT 0,
  creators_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  impact_score_total BIGINT DEFAULT 0,
  
  -- Tracking
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_sound_date UNIQUE(sound_id, date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sound_daily_sound_date ON sound_daily_stats(sound_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sound_daily_date ON sound_daily_stats(date DESC);

COMMENT ON TABLE sound_daily_stats IS 'Daily aggregated metrics for sounds, bucketed by video created_at date';
COMMENT ON COLUMN sound_daily_stats.date IS 'Date from video created_at (not ingestion date)';
COMMENT ON COLUMN sound_daily_stats.videos_count IS 'Number of videos using this sound created on this date';
COMMENT ON COLUMN sound_daily_stats.creators_count IS 'Number of unique creators using this sound on this date';

-- ============================================================================
-- COMMUNITY_DAILY_STATS
-- Daily aggregated metrics for communities
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Aggregate metrics for videos with community hashtags on this date
  videos_count INTEGER DEFAULT 0,
  creators_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  impact_score_total BIGINT DEFAULT 0,
  
  -- Tracking
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_community_date UNIQUE(community_id, date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_daily_community_date ON community_daily_stats(community_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_community_daily_date ON community_daily_stats(date DESC);

COMMENT ON TABLE community_daily_stats IS 'Daily aggregated metrics for communities, bucketed by video created_at date';
COMMENT ON COLUMN community_daily_stats.date IS 'Date from video created_at (not ingestion date)';
COMMENT ON COLUMN community_daily_stats.videos_count IS 'Number of videos with community hashtags created on this date';
COMMENT ON COLUMN community_daily_stats.creators_count IS 'Number of unique creators contributing to this community on this date';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all daily stats tables
ALTER TABLE hashtag_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_daily_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for all users
CREATE POLICY "Public read access" ON hashtag_daily_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON creator_daily_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sound_daily_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_daily_stats FOR SELECT USING (true);

-- Only service role can write (ingestion system)
CREATE POLICY "Service role write access" ON hashtag_daily_stats 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write access" ON creator_daily_stats 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write access" ON sound_daily_stats 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write access" ON community_daily_stats 
  FOR ALL USING (auth.role() = 'service_role');

