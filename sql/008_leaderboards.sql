-- Leaderboard Tables for Precomputed Rankings
-- These tables store precomputed rankings across different time periods

-- ============================================================================
-- LEADERBOARDS_CREATORS
-- Precomputed creator rankings by time period
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboards_creators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- '1h', '24h', '7d', '30d', 'all'
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  followers_delta INTEGER DEFAULT 0,
  videos_delta INTEGER DEFAULT 0,
  likes_delta BIGINT DEFAULT 0,
  er_7d REAL, -- 7-day engagement rate
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_leaderboard_creator UNIQUE(period, rank, creator_id),
  CONSTRAINT valid_period CHECK (period IN ('1h', '24h', '7d', '30d', 'all'))
);

-- Indexes for leaderboards_creators
CREATE INDEX IF NOT EXISTS idx_leaderboard_creators_period_rank ON leaderboards_creators(period, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_creators_creator ON leaderboards_creators(creator_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_creators_period ON leaderboards_creators(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_creators_computed_at ON leaderboards_creators(computed_at DESC);

-- ============================================================================
-- LEADERBOARDS_VIDEOS
-- Precomputed video rankings
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboards_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- '1h', '24h', '7d', '30d', 'all'
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  views_delta INTEGER DEFAULT 0,
  likes_delta INTEGER DEFAULT 0,
  comments_delta INTEGER DEFAULT 0,
  er_24h REAL, -- 24-hour engagement rate
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_leaderboard_video UNIQUE(period, rank, video_id),
  CONSTRAINT valid_period CHECK (period IN ('1h', '24h', '7d', '30d', 'all'))
);

-- Indexes for leaderboards_videos
CREATE INDEX IF NOT EXISTS idx_leaderboard_videos_period_rank ON leaderboards_videos(period, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_videos_video ON leaderboards_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_videos_period ON leaderboards_videos(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_videos_computed_at ON leaderboards_videos(computed_at DESC);

-- ============================================================================
-- LEADERBOARDS_SOUNDS
-- Precomputed sound rankings
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboards_sounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sound_id TEXT NOT NULL REFERENCES sounds_hot(sound_id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- '1h', '24h', '7d', '30d', 'all'
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  videos_delta INTEGER DEFAULT 0,
  views_delta BIGINT DEFAULT 0,
  likes_delta BIGINT DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_leaderboard_sound UNIQUE(period, rank, sound_id),
  CONSTRAINT valid_period CHECK (period IN ('1h', '24h', '7d', '30d', 'all'))
);

-- Indexes for leaderboards_sounds
CREATE INDEX IF NOT EXISTS idx_leaderboard_sounds_period_rank ON leaderboards_sounds(period, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_sounds_sound ON leaderboards_sounds(sound_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_sounds_period ON leaderboards_sounds(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_sounds_computed_at ON leaderboards_sounds(computed_at DESC);

-- ============================================================================
-- LEADERBOARDS_HASHTAGS
-- Precomputed hashtag rankings
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboards_hashtags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  period TEXT NOT NULL, -- '1h', '24h', '7d', '30d', 'all'
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  views_delta BIGINT DEFAULT 0,
  videos_delta INTEGER DEFAULT 0,
  creators_delta INTEGER DEFAULT 0,
  trend_score_delta REAL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_leaderboard_hashtag UNIQUE(period, rank, hashtag),
  CONSTRAINT valid_period CHECK (period IN ('1h', '24h', '7d', '30d', 'all'))
);

-- Indexes for leaderboards_hashtags
CREATE INDEX IF NOT EXISTS idx_leaderboard_hashtags_period_rank ON leaderboards_hashtags(period, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_hashtags_hashtag ON leaderboards_hashtags(hashtag);
CREATE INDEX IF NOT EXISTS idx_leaderboard_hashtags_period ON leaderboards_hashtags(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_hashtags_computed_at ON leaderboards_hashtags(computed_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all leaderboard tables
ALTER TABLE leaderboards_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards_hashtags ENABLE ROW LEVEL SECURITY;

-- Public read access to leaderboards
CREATE POLICY "Public read access" ON leaderboards_creators FOR SELECT USING (true);
CREATE POLICY "Public read access" ON leaderboards_videos FOR SELECT USING (true);
CREATE POLICY "Public read access" ON leaderboards_sounds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON leaderboards_hashtags FOR SELECT USING (true);

-- Only system/authenticated can write to leaderboards
CREATE POLICY "Authenticated write access" ON leaderboards_creators 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON leaderboards_videos 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON leaderboards_sounds 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON leaderboards_hashtags 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE leaderboards_creators IS 'Precomputed creator rankings across time periods';
COMMENT ON TABLE leaderboards_videos IS 'Precomputed video rankings across time periods';
COMMENT ON TABLE leaderboards_sounds IS 'Precomputed sound rankings across time periods';
COMMENT ON TABLE leaderboards_hashtags IS 'Precomputed hashtag rankings across time periods';

