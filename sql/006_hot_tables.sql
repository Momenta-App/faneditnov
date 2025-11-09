-- Hot Tables for Fast Access
-- These tables store denormalized, frequently accessed data for fast UI queries

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CREATORS_HOT
-- Fast lookup table for creator profiles displayed on creator pages
-- ============================================================================

CREATE TABLE IF NOT EXISTS creators_hot (
  creator_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  bio TEXT,
  bio_links JSONB DEFAULT '[]'::JSONB,
  is_private BOOLEAN DEFAULT FALSE,
  is_business_account BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for creators_hot
CREATE INDEX IF NOT EXISTS idx_creators_username ON creators_hot(username);
CREATE INDEX IF NOT EXISTS idx_creators_followers ON creators_hot(followers_count DESC);
CREATE INDEX IF NOT EXISTS idx_creators_videos_count ON creators_hot(videos_count DESC);
CREATE INDEX IF NOT EXISTS idx_creators_verified ON creators_hot(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_creators_likes_total ON creators_hot(likes_total DESC);
CREATE INDEX IF NOT EXISTS idx_creators_updated_at ON creators_hot(updated_at DESC);

-- Triggers for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_creators_hot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creators_hot_updated_at
  BEFORE UPDATE ON creators_hot
  FOR EACH ROW
  EXECUTE FUNCTION update_creators_hot_updated_at();

-- ============================================================================
-- VIDEOS_HOT
-- Optimized table for video feeds and trending displays
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos_hot (
  video_id TEXT PRIMARY KEY,
  post_id TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  url TEXT,
  caption TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  collect_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  video_url TEXT,
  cover_url TEXT,
  thumbnail_url TEXT,
  is_ads BOOLEAN DEFAULT FALSE,
  language TEXT,
  region TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for videos_hot
CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos_hot(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos_hot(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_views ON videos_hot(views_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_likes ON videos_hot(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_post_id ON videos_hot(post_id);
CREATE INDEX IF NOT EXISTS idx_videos_first_seen_at ON videos_hot(first_seen_at DESC);

-- Full-text search on caption and description
CREATE INDEX IF NOT EXISTS idx_videos_caption_trgm ON videos_hot USING GIN(caption gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_videos_description_trgm ON videos_hot USING GIN(description gin_trgm_ops);

-- Triggers
CREATE OR REPLACE FUNCTION update_videos_hot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_hot_updated_at
  BEFORE UPDATE ON videos_hot
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_hot_updated_at();

-- ============================================================================
-- SOUNDS_HOT
-- Fast access for sound browsing and trending sounds page
-- ============================================================================

CREATE TABLE IF NOT EXISTS sounds_hot (
  sound_id TEXT PRIMARY KEY,
  sound_title TEXT NOT NULL,
  sound_author TEXT,
  music_url TEXT,
  music_duration INTEGER,
  music_is_original BOOLEAN DEFAULT FALSE,
  cover_url TEXT,
  music_play_url TEXT,
  views_total BIGINT DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sounds_hot
CREATE INDEX IF NOT EXISTS idx_sounds_title_trgm ON sounds_hot USING GIN(sound_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sounds_views_total ON sounds_hot(views_total DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_videos_count ON sounds_hot(videos_count DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_likes_total ON sounds_hot(likes_total DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_last_used_at ON sounds_hot(last_used_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION update_sounds_hot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sounds_hot_updated_at
  BEFORE UPDATE ON sounds_hot
  FOR EACH ROW
  EXECUTE FUNCTION update_sounds_hot_updated_at();

-- ============================================================================
-- HASHTAGS_HOT
-- Optimized for hashtag trending and search
-- ============================================================================

CREATE TABLE IF NOT EXISTS hashtags_hot (
  hashtag TEXT PRIMARY KEY,
  hashtag_norm TEXT NOT NULL, -- Normalized (lowercase, no #)
  views_total BIGINT DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  creators_count INTEGER DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  trend_score REAL DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for hashtags_hot
CREATE INDEX IF NOT EXISTS idx_hashtags_norm ON hashtags_hot(hashtag_norm);
CREATE INDEX IF NOT EXISTS idx_hashtags_views ON hashtags_hot(views_total DESC);
CREATE INDEX IF NOT EXISTS idx_hashtags_videos_count ON hashtags_hot(videos_count DESC);
CREATE INDEX IF NOT EXISTS idx_hashtags_trend_score ON hashtags_hot(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_hashtags_creators_count ON hashtags_hot(creators_count DESC);

-- Trigger for auto-normalizing hashtag_norm
CREATE OR REPLACE FUNCTION normalize_hashtag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hashtag_norm = LOWER(REPLACE(NEW.hashtag, '#', ''));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_hashtag
  BEFORE INSERT OR UPDATE ON hashtags_hot
  FOR EACH ROW
  EXECUTE FUNCTION normalize_hashtag();

-- ============================================================================
-- Grant Permissions (if using RLS)
-- ============================================================================

-- Enable RLS on all hot tables
ALTER TABLE creators_hot ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos_hot ENABLE ROW LEVEL SECURITY;
ALTER TABLE sounds_hot ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags_hot ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust as needed for auth)
CREATE POLICY "Public read access" ON creators_hot FOR SELECT USING (true);
CREATE POLICY "Public read access" ON videos_hot FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sounds_hot FOR SELECT USING (true);
CREATE POLICY "Public read access" ON hashtags_hot FOR SELECT USING (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE creators_hot IS 'Hot table for fast creator profile lookups';
COMMENT ON TABLE videos_hot IS 'Hot table for fast video feed queries';
COMMENT ON TABLE sounds_hot IS 'Hot table for fast sound browsing';
COMMENT ON TABLE hashtags_hot IS 'Hot table for fast hashtag search and trending';

