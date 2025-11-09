-- Timeseries Tables for Historical Metrics Tracking
-- These tables track metrics over time for analytics and growth tracking

-- ============================================================================
-- VIDEO_METRICS_TIMESERIES
-- Track video performance metrics over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_metrics_timeseries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  collect_count INTEGER DEFAULT 0,
  engagement_rate REAL,
  views_delta INTEGER DEFAULT 0,
  likes_delta INTEGER DEFAULT 0,
  comments_delta INTEGER DEFAULT 0,
  shares_delta INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_video_metric UNIQUE(video_id, collected_at)
);

-- Indexes for video_metrics_timeseries
CREATE INDEX IF NOT EXISTS idx_video_metrics_video_id ON video_metrics_timeseries(video_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_collected_at ON video_metrics_timeseries(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_views ON video_metrics_timeseries(views_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_likes ON video_metrics_timeseries(likes_count DESC);

-- Partition by month for better query performance (optional, can be added later)
-- This will be handled manually as data grows

COMMENT ON TABLE video_metrics_timeseries IS 'Historical tracking of video engagement metrics over time';
COMMENT ON COLUMN video_metrics_timeseries.collected_at IS 'Timestamp when metrics were collected';
COMMENT ON COLUMN video_metrics_timeseries.engagement_rate IS 'Calculated engagement rate: (likes + comments + shares) / views';

-- ============================================================================
-- CREATOR_METRICS_TIMESERIES
-- Track creator growth metrics over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_metrics_timeseries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  followers_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  engagement_rate REAL,
  followers_delta INTEGER DEFAULT 0,
  videos_delta INTEGER DEFAULT 0,
  likes_delta BIGINT DEFAULT 0,
  avg_views_per_video REAL,
  avg_likes_per_video REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_metric UNIQUE(creator_id, collected_at)
);

-- Indexes for creator_metrics_timeseries
CREATE INDEX IF NOT EXISTS idx_creator_metrics_creator_id ON creator_metrics_timeseries(creator_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_metrics_collected_at ON creator_metrics_timeseries(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_metrics_followers ON creator_metrics_timeseries(followers_count DESC);

COMMENT ON TABLE creator_metrics_timeseries IS 'Historical tracking of creator growth and engagement metrics';
COMMENT ON COLUMN creator_metrics_timeseries.collected_at IS 'Timestamp when metrics were collected';

-- ============================================================================
-- SOUND_METRICS_TIMESERIES
-- Track sound/audio usage metrics over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS sound_metrics_timeseries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sound_id TEXT NOT NULL REFERENCES sounds_hot(sound_id) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  videos_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  videos_delta INTEGER DEFAULT 0,
  views_delta BIGINT DEFAULT 0,
  likes_delta BIGINT DEFAULT 0,
  avg_views_per_video REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_sound_metric UNIQUE(sound_id, collected_at)
);

-- Indexes for sound_metrics_timeseries
CREATE INDEX IF NOT EXISTS idx_sound_metrics_sound_id ON sound_metrics_timeseries(sound_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_sound_metrics_collected_at ON sound_metrics_timeseries(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_sound_metrics_videos_count ON sound_metrics_timeseries(videos_count DESC);

COMMENT ON TABLE sound_metrics_timeseries IS 'Historical tracking of sound usage and engagement metrics';

-- ============================================================================
-- HASHTAG_METRICS_TIMESERIES
-- Track hashtag usage and trending metrics over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS hashtag_metrics_timeseries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  videos_count INTEGER DEFAULT 0,
  creators_count INTEGER DEFAULT 0,
  views_total BIGINT DEFAULT 0,
  trend_score REAL DEFAULT 0,
  videos_delta INTEGER DEFAULT 0,
  creators_delta INTEGER DEFAULT 0,
  views_delta BIGINT DEFAULT 0,
  trend_score_delta REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_hashtag_metric UNIQUE(hashtag, collected_at)
);

-- Indexes for hashtag_metrics_timeseries
CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_hashtag ON hashtag_metrics_timeseries(hashtag, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_collected_at ON hashtag_metrics_timeseries(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_trend_score ON hashtag_metrics_timeseries(trend_score DESC);

COMMENT ON TABLE hashtag_metrics_timeseries IS 'Historical tracking of hashtag usage and trending metrics';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all timeseries tables
ALTER TABLE video_metrics_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_metrics_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_metrics_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_metrics_timeseries ENABLE ROW LEVEL SECURITY;

-- Public read access for analytics
CREATE POLICY "Public read access" ON video_metrics_timeseries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON creator_metrics_timeseries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sound_metrics_timeseries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON hashtag_metrics_timeseries FOR SELECT USING (true);

-- Only authenticated/system can write metrics
CREATE POLICY "Authenticated write access" ON video_metrics_timeseries 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON creator_metrics_timeseries 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON sound_metrics_timeseries 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON hashtag_metrics_timeseries 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- Helper View: Recent Video Metrics
-- Quick access to latest metrics for each video
-- ============================================================================

CREATE OR REPLACE VIEW video_metrics_recent AS
SELECT DISTINCT ON (video_id)
  video_id,
  collected_at,
  views_count,
  likes_count,
  comments_count,
  shares_count,
  engagement_rate,
  views_delta,
  likes_delta
FROM video_metrics_timeseries
ORDER BY video_id, collected_at DESC;

COMMENT ON VIEW video_metrics_recent IS 'Latest metrics for each video';

-- ============================================================================
-- Helper View: Recent Creator Metrics
-- ============================================================================

CREATE OR REPLACE VIEW creator_metrics_recent AS
SELECT DISTINCT ON (creator_id)
  creator_id,
  collected_at,
  followers_count,
  videos_count,
  likes_total,
  engagement_rate,
  followers_delta,
  videos_delta
FROM creator_metrics_timeseries
ORDER BY creator_id, collected_at DESC;

COMMENT ON VIEW creator_metrics_recent IS 'Latest metrics for each creator';

