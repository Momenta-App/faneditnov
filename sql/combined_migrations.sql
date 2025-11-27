-- Combined Migration Script
-- Generated: 2025-11-19T21:25:01.502Z
-- 
-- This file contains all migration SQL files combined in the correct order.
-- Copy and paste this entire file into Supabase SQL Editor and run it.
--
-- IMPORTANT: Run this in your TARGET database (PRIMARY database)
-- Database: TARGET_DATABASE
--
-- ============================================================================
-- MIGRATION START
-- ============================================================================


-- ============================================================================
-- 006_hot_tables.sql
-- ============================================================================

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
  total_views INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_videos_views ON videos_hot(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_videos_likes ON videos_hot(like_count DESC);
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




-- ============================================================================
-- 007_cold_tables.sql
-- ============================================================================

-- Cold Tables for Complete Data Storage
-- These tables store full JSONB data for complete records and analytics

-- ============================================================================
-- CREATOR_PROFILES_COLD
-- Complete creator profile information with full JSON
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_profiles_cold (
  creator_id TEXT PRIMARY KEY REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  full_json JSONB NOT NULL,
  business_category TEXT,
  bio TEXT,
  bio_links JSONB DEFAULT '[]'::JSONB,
  join_date TIMESTAMP WITH TIME ZONE,
  is_private BOOLEAN DEFAULT FALSE,
  is_business_account BOOLEAN DEFAULT FALSE,
  language TEXT,
  region TEXT,
  platform_identities JSONB, -- Cross-platform handles (TikTok, Instagram, YouTube, etc.)
  tags JSONB,
  labels JSONB,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for creator_profiles_cold
CREATE INDEX IF NOT EXISTS idx_creator_cold_full_json ON creator_profiles_cold USING GIN(full_json);
CREATE INDEX IF NOT EXISTS idx_creator_cold_platform_identities ON creator_profiles_cold USING GIN(platform_identities);

-- Triggers
CREATE OR REPLACE FUNCTION update_creator_profiles_cold_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creator_profiles_cold_updated_at
  BEFORE UPDATE ON creator_profiles_cold
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_profiles_cold_updated_at();

-- ============================================================================
-- VIDEOS_COLD
-- Complete video metadata and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos_cold (
  video_id TEXT PRIMARY KEY REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  full_json JSONB NOT NULL,
  hashtags TEXT[],
  mentions TEXT[],
  locations JSONB,
  geo_location JSONB,
  ad_metadata JSONB,
  labels JSONB,
  effect_info JSONB,
  music_details JSONB,
  interaction_data JSONB,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for videos_cold
CREATE INDEX IF NOT EXISTS idx_videos_cold_json ON videos_cold USING GIN(full_json);
CREATE INDEX IF NOT EXISTS idx_videos_cold_hashtags ON videos_cold USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_videos_cold_mentions ON videos_cold USING GIN(mentions);
CREATE INDEX IF NOT EXISTS idx_videos_cold_ad_metadata ON videos_cold USING GIN(ad_metadata);

-- Triggers
CREATE OR REPLACE FUNCTION update_videos_cold_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_cold_updated_at
  BEFORE UPDATE ON videos_cold
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_cold_updated_at();

-- ============================================================================
-- SOUNDS_COLD
-- Complete sound/audio metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS sounds_cold (
  sound_id TEXT PRIMARY KEY REFERENCES sounds_hot(sound_id) ON DELETE CASCADE ON UPDATE CASCADE,
  full_json JSONB NOT NULL,
  music_details JSONB,
  cover_url TEXT,
  music_play_url TEXT,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sounds_cold
CREATE INDEX IF NOT EXISTS idx_sounds_cold_json ON sounds_cold USING GIN(full_json);
CREATE INDEX IF NOT EXISTS idx_sounds_cold_music_details ON sounds_cold USING GIN(music_details);

-- Triggers
CREATE OR REPLACE FUNCTION update_sounds_cold_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sounds_cold_updated_at
  BEFORE UPDATE ON sounds_cold
  FOR EACH ROW
  EXECUTE FUNCTION update_sounds_cold_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all cold tables
ALTER TABLE creator_profiles_cold ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos_cold ENABLE ROW LEVEL SECURITY;
ALTER TABLE sounds_cold ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access only (cold tables contain sensitive data)
-- Public can read but cannot write
CREATE POLICY "Public read access" ON creator_profiles_cold FOR SELECT USING (true);
CREATE POLICY "Public read access" ON videos_cold FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sounds_cold FOR SELECT USING (true);

-- Only authenticated users can insert/update
CREATE POLICY "Authenticated write access" ON creator_profiles_cold 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON videos_cold 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON sounds_cold 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE creator_profiles_cold IS 'Cold storage for complete creator profile data';
COMMENT ON TABLE videos_cold IS 'Cold storage for complete video metadata and analytics';
COMMENT ON TABLE sounds_cold IS 'Cold storage for complete sound/audio metadata';




-- ============================================================================
-- 010_fact_tables.sql
-- ============================================================================

-- Fact Tables for Relationships & Analytics
-- These tables track relationships between entities and data provenance

-- ============================================================================
-- VIDEO_SOUND_FACTS
-- Tracks which videos use which sounds (many-to-many relationship)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_sound_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  sound_id TEXT NOT NULL REFERENCES sounds_hot(sound_id) ON DELETE CASCADE,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  views_at_snapshot INTEGER DEFAULT 0,
  likes_at_snapshot INTEGER DEFAULT 0,
  comments_at_snapshot INTEGER DEFAULT 0,
  is_first_use BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_video_sound UNIQUE(video_id, sound_id)
);

-- Indexes for video_sound_facts
CREATE INDEX IF NOT EXISTS idx_video_sound_video ON video_sound_facts(video_id);
CREATE INDEX IF NOT EXISTS idx_video_sound_sound ON video_sound_facts(sound_id);
CREATE INDEX IF NOT EXISTS idx_video_sound_created_at ON video_sound_facts(created_at DESC);

COMMENT ON TABLE video_sound_facts IS 'Tracking which sounds are used in which videos';
COMMENT ON COLUMN video_sound_facts.snapshot_at IS 'When this relationship was recorded';
COMMENT ON COLUMN video_sound_facts.is_first_use IS 'True if this is the first time this sound was used';

-- ============================================================================
-- VIDEO_HASHTAG_FACTS
-- Tracks video-hashtag relationships (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_hashtag_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  views_at_snapshot INTEGER DEFAULT 0,
  likes_at_snapshot INTEGER DEFAULT 0,
  position_in_caption INTEGER, -- Order in the video caption (1st, 2nd, 3rd hashtag, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_video_hashtag UNIQUE(video_id, hashtag)
);

-- Indexes for video_hashtag_facts
CREATE INDEX IF NOT EXISTS idx_video_hashtag_video ON video_hashtag_facts(video_id);
CREATE INDEX IF NOT EXISTS idx_video_hashtag_hashtag ON video_hashtag_facts(hashtag);
CREATE INDEX IF NOT EXISTS idx_video_hashtag_created_at ON video_hashtag_facts(created_at DESC);

COMMENT ON TABLE video_hashtag_facts IS 'Tracking which hashtags appear in which videos';
COMMENT ON COLUMN video_hashtag_facts.position_in_caption IS 'Order of hashtag in video caption';

-- ============================================================================
-- CREATOR_VIDEO_FACTS
-- Tracks creator-video relationships (already covered by FK, but for analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_video_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  creator_followers_at_snapshot INTEGER DEFAULT 0,
  video_views_at_snapshot INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_video UNIQUE(creator_id, video_id)
);

-- Indexes for creator_video_facts
CREATE INDEX IF NOT EXISTS idx_creator_video_creator ON creator_video_facts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_video_video ON creator_video_facts(video_id);

COMMENT ON TABLE creator_video_facts IS 'Analytics snapshot for creator-video relationships';

-- ============================================================================
-- RAW_REFS
-- Track data provenance and checksums for integrity verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS raw_refs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'video', 'creator', 'sound', 'hashtag'
  entity_id TEXT NOT NULL,
  snapshot_id TEXT,
  source_url TEXT,
  checksum TEXT, -- MD5 or SHA256 hash of raw data
  raw_data_snippet TEXT, -- First 1000 chars of raw data for debugging
  ingestion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_size_bytes INTEGER,
  compression_type TEXT, -- 'none', 'gzip', 'json_minified'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for raw_refs
CREATE INDEX IF NOT EXISTS idx_raw_refs_entity ON raw_refs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_raw_refs_snapshot ON raw_refs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_raw_refs_checksum ON raw_refs(checksum);
CREATE INDEX IF NOT EXISTS idx_raw_refs_created_at ON raw_refs(created_at DESC);

COMMENT ON TABLE raw_refs IS 'Track data provenance and integrity for debugging and audit';
COMMENT ON COLUMN raw_refs.entity_type IS 'Type of entity: video, creator, sound, or hashtag';
COMMENT ON COLUMN raw_refs.checksum IS 'Hash of raw data for integrity verification';

-- ============================================================================
-- VIDEO_CREATOR_MENTIONS
-- Track when creators mention other creators in videos
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_creator_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  mentioned_creator_id TEXT NOT NULL, -- May not be in our creators_hot yet
  mentioned_username TEXT,
  mention_type TEXT, -- 'in_caption', 'tagged', 'collaborator', 'duet'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for video_creator_mentions
CREATE INDEX IF NOT EXISTS idx_video_mentions_video ON video_creator_mentions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_mentions_creator ON video_creator_mentions(mentioned_creator_id);

COMMENT ON TABLE video_creator_mentions IS 'Track when videos mention or tag other creators';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all fact tables
ALTER TABLE video_sound_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_hashtag_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_video_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_creator_mentions ENABLE ROW LEVEL SECURITY;

-- Public read access for analytics
CREATE POLICY "Public read access" ON video_sound_facts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_hashtag_facts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON creator_video_facts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON raw_refs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON video_creator_mentions FOR SELECT USING (true);

-- Only authenticated can write
CREATE POLICY "Authenticated write access" ON video_sound_facts 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON video_hashtag_facts 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON creator_video_facts 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON raw_refs 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON video_creator_mentions 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- Helper View: Sound Usage Analytics
-- Quick access to which sounds are most used
-- ============================================================================

CREATE OR REPLACE VIEW sound_usage_analytics AS
SELECT 
  s.sound_id,
  s.sound_title,
  s.sound_author,
  COUNT(vsf.video_id) as usage_count,
  MAX(vsf.views_at_snapshot) as max_views,
  AVG(vsf.likes_at_snapshot) as avg_likes,
  MIN(vsf.snapshot_at) as first_used_at,
  MAX(vsf.snapshot_at) as last_used_at
FROM sounds_hot s
LEFT JOIN video_sound_facts vsf ON s.sound_id = vsf.sound_id
GROUP BY s.sound_id, s.sound_title, s.sound_author;

COMMENT ON VIEW sound_usage_analytics IS 'Analytics for sound usage across videos';

-- ============================================================================
-- Helper View: Hashtag Usage Analytics
-- ============================================================================

CREATE OR REPLACE VIEW hashtag_usage_analytics AS
SELECT 
  h.hashtag,
  h.hashtag_norm,
  COUNT(vhf.video_id) as video_count,
  COUNT(DISTINCT v.creator_id) as creator_count,
  AVG(vhf.likes_at_snapshot) as avg_likes,
  MAX(vhf.views_at_snapshot) as max_views
FROM hashtags_hot h
LEFT JOIN video_hashtag_facts vhf ON h.hashtag = vhf.hashtag
LEFT JOIN videos_hot v ON vhf.video_id = v.video_id
GROUP BY h.hashtag, h.hashtag_norm;

COMMENT ON VIEW hashtag_usage_analytics IS 'Analytics for hashtag usage across videos';




-- ============================================================================
-- 009_timeseries.sql
-- ============================================================================

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
  total_views INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_video_metrics_views ON video_metrics_timeseries(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_likes ON video_metrics_timeseries(like_count DESC);

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
  total_views,
  like_count,
  comment_count,
  share_count,
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




-- ============================================================================
-- 008_leaderboards.sql
-- ============================================================================

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




-- ============================================================================
-- 017_communities.sql
-- ============================================================================

-- Migration: Communities Feature
-- This migration adds:
-- 1. communities table (main community data)
-- 2. community_video_memberships table
-- 3. community_creator_memberships table (with aggregates)
-- 4. community_hashtag_memberships table (with aggregates)
-- 5. Helper functions for matching, membership updates, and backfills

-- ============================================================================
-- COMMUNITIES TABLE
-- Main table for community entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  profile_image_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  linked_hashtags TEXT[] NOT NULL DEFAULT '{}',
  links JSONB DEFAULT '{}',
  total_views BIGINT DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  total_creators INTEGER DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Indexes for communities
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_linked_hashtags ON communities USING GIN(linked_hashtags);
CREATE INDEX IF NOT EXISTS idx_communities_total_views ON communities(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_communities_total_videos ON communities(total_videos DESC);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_communities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_communities_updated_at ON communities;
CREATE TRIGGER trigger_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_communities_updated_at();

-- RLS Policies
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON communities;
CREATE POLICY "Public read access" ON communities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated write access" ON communities;
CREATE POLICY "Authenticated write access" ON communities 
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE communities IS 'Communities are multi-hashtag collections with real-time aggregates';
COMMENT ON COLUMN communities.linked_hashtags IS 'Array of normalized hashtag names that match this community';
COMMENT ON COLUMN communities.links IS 'Social media and website links in JSONB format';

-- ============================================================================
-- COMMUNITY_VIDEO_MEMBERSHIPS
-- Tracks which videos belong to which communities
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_video_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_video UNIQUE(community_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_community_video_community ON community_video_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_video_video ON community_video_memberships(video_id);
CREATE INDEX IF NOT EXISTS idx_community_video_joined_at ON community_video_memberships(joined_at DESC);

-- ============================================================================
-- COMMUNITY_CREATOR_MEMBERSHIPS
-- Tracks which creators belong to which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_creator_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  first_video_at TIMESTAMP WITH TIME ZONE,
  last_video_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_creator UNIQUE(community_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_community_creator_community ON community_creator_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_creator ON community_creator_memberships(creator_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_total_views ON community_creator_memberships(total_views DESC);

-- ============================================================================
-- COMMUNITY_HASHTAG_MEMBERSHIPS
-- Tracks which hashtags appear in which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_hashtag_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  first_used_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_hashtag UNIQUE(community_id, hashtag)
);

CREATE INDEX IF NOT EXISTS idx_community_hashtag_community ON community_hashtag_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_hashtag ON community_hashtag_memberships(hashtag);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_total_views ON community_hashtag_memberships(total_views DESC);

-- Enable RLS
ALTER TABLE community_video_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_creator_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_hashtag_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON community_video_memberships;
DROP POLICY IF EXISTS "Public read access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Public read access" ON community_hashtag_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_video_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_hashtag_memberships;

CREATE POLICY "Public read access" ON community_video_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_creator_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_hashtag_memberships FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON community_video_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_creator_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_hashtag_memberships 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- ============================================================================
-- FUNCTION: check_video_community_match
-- Returns TRUE if a video's hashtags intersect with a community's linked_hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION check_video_community_match(
  p_video_id TEXT,
  p_community_hashtags TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM video_hashtag_facts vhf
    WHERE vhf.video_id = p_video_id
      AND vhf.hashtag = ANY(p_community_hashtags)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: get_video_hashtags
-- Returns array of hashtags for a given video
-- ============================================================================

CREATE OR REPLACE FUNCTION get_video_hashtags(p_video_id TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT hashtag 
    FROM video_hashtag_facts 
    WHERE video_id = p_video_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_community_video_membership
-- Adds or removes a video from a community based on hashtag match
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_video_membership(
  p_community_id UUID,
  p_video_id TEXT
) RETURNS void AS $$
DECLARE
  v_matches BOOLEAN;
  v_play_count INTEGER;
  v_creator_id TEXT;
  v_video_hashtags TEXT[];
  v_hashtag TEXT;
BEGIN
  -- Get video hashtags
  v_video_hashtags := get_video_hashtags(p_video_id);
  
  -- Check if video matches community
  v_matches := EXISTS (
    SELECT 1
    FROM communities c
    WHERE c.id = p_community_id
      AND c.linked_hashtags && v_video_hashtags
  );
  
  -- Get video details
  SELECT total_views, creator_id INTO v_play_count, v_creator_id
  FROM videos_hot
  WHERE video_id = p_video_id;
  
  IF v_matches THEN
    -- Add/update membership
    INSERT INTO community_video_memberships (community_id, video_id)
    VALUES (p_community_id, p_video_id)
    ON CONFLICT (community_id, video_id) DO UPDATE SET
      last_updated = NOW();
    
    -- Update creator membership
    INSERT INTO community_creator_memberships (community_id, creator_id, total_views, video_count)
    VALUES (p_community_id, v_creator_id, v_play_count, 1)
    ON CONFLICT (community_id, creator_id) DO UPDATE SET
      total_views = community_creator_memberships.total_views + EXCLUDED.total_views,
      video_count = community_creator_memberships.video_count + 1,
      last_video_at = NOW(),
      last_updated = NOW();
    
    -- Update hashtag memberships for each matching hashtag
    FOR v_hashtag IN 
      SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      WHERE hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
    LOOP
      INSERT INTO community_hashtag_memberships (community_id, hashtag, total_views, video_count)
      VALUES (p_community_id, v_hashtag, v_play_count, 1)
      ON CONFLICT (community_id, hashtag) DO UPDATE SET
        total_views = community_hashtag_memberships.total_views + EXCLUDED.total_views,
        video_count = community_hashtag_memberships.video_count + 1,
        last_used_at = NOW(),
        last_updated = NOW();
    END LOOP;
  ELSE
    -- First check if video should remain (might have other matching hashtags)
    SELECT EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = p_community_id
        AND c.linked_hashtags && v_video_hashtags
    ) INTO v_matches;
    
    -- Only remove if no hashtags match
    IF NOT v_matches THEN
      DELETE FROM community_video_memberships
      WHERE community_id = p_community_id AND video_id = p_video_id;
      
      -- Update creator membership (decrement)
      UPDATE community_creator_memberships
      SET total_views = total_views - v_play_count,
          video_count = video_count - 1,
          last_updated = NOW()
      WHERE community_id = p_community_id AND creator_id = v_creator_id;
      
      -- Update hashtag memberships (decrement for all video hashtags)
      FOR v_hashtag IN SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      LOOP
        UPDATE community_hashtag_memberships
        SET total_views = total_views - v_play_count,
            video_count = video_count - 1,
            last_updated = NOW()
        WHERE community_id = p_community_id AND hashtag = v_hashtag;
      END LOOP;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_community_totals
-- Recalculates and updates total aggregates for a community
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_totals(p_community_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE communities
  SET 
    total_videos = (
      SELECT COUNT(DISTINCT video_id) 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    ),
    total_views = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: backfill_community
-- Backfills a community's memberships from existing videos
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_community(p_community_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hashtags TEXT[];
  v_video RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get community hashtags
  SELECT linked_hashtags INTO v_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No hashtags linked to community');
  END IF;
  
  -- Process each existing video
  FOR v_video IN 
    SELECT DISTINCT v.video_id, v.creator_id, v.total_views
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = ANY(v_hashtags)
  LOOP
    PERFORM update_community_video_membership(p_community_id, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object('success', true, 'videos_processed', v_count);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: recalculate_community_hashtag_memberships
-- Recalculates hashtag memberships from scratch based on actual videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community, but only for hashtags in linked_hashtags
  FOR v_hashtag IN 
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum views for this hashtag in this community
    SELECT COUNT(*), COALESCE(SUM(v.total_views), 0)
    INTO v_count, v_views
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag = v_hashtag;
    
    -- Insert the recalculated membership
    INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, joined_at, last_updated)
    VALUES (p_community_id, v_hashtag, v_count, v_views, NOW(), NOW());
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: recalculate_community_creator_memberships
-- Recalculates creator memberships from scratch based on actual videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_creator_id IN 
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
  LOOP
    -- Count videos and sum views for this creator in this community
    SELECT 
      COUNT(*), 
      COALESCE(SUM(v.total_views), 0),
      MIN(v.created_at),
      MAX(v.created_at)
    INTO v_count, v_views, v_first_video_at, v_last_video_at
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND v.creator_id = v_creator_id;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, 
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: sync_community_hashtags
-- Syncs community video memberships after hashtag changes
-- Intelligently adds new videos and removes only videos with NO matching hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_community_hashtags(
  p_community_id UUID,
  p_old_hashtags TEXT[],
  p_new_hashtags TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_new_hashtags TEXT[];  -- Hashtags that were added
  v_removed_hashtags TEXT[];  -- Hashtags that were removed
  v_video RECORD;
  v_video_hashtags TEXT[];
  v_matches BOOLEAN;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
BEGIN
  -- Get newly added hashtags (ones in new but not in old)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_new_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_old_hashtags))
  ) INTO v_new_hashtags;
  
  -- Get removed hashtags (ones in old but not in new)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_old_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_new_hashtags))
  ) INTO v_removed_hashtags;
  
  -- Add videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT v.video_id, v.creator_id, v.total_views
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = ANY(v_new_hashtags)
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = v.video_id
        )
    LOOP
      PERFORM update_community_video_membership(p_community_id, v_video.video_id);
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- Remove videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    LOOP
      -- Get current video hashtags
      v_video_hashtags := get_video_hashtags(v_video.video_id);
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        -- Delete video membership
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id;
        
        v_removed_count := v_removed_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Recalculate all memberships from scratch based on actual videos
  -- This ensures counts are always accurate
  PERFORM recalculate_community_hashtag_memberships(p_community_id);
  PERFORM recalculate_community_creator_memberships(p_community_id);
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'new_hashtags', v_new_hashtags,
    'removed_hashtags', v_removed_hashtags
  );
END;
$$ LANGUAGE plpgsql;




-- ============================================================================
-- 018_profiles_and_auth.sql
-- ============================================================================

-- Migration: Profiles and Authentication
-- This migration adds:
-- 1. profiles table (links auth.users to app user profiles)
-- 2. Role enum and role-based permissions
-- 3. Profile creation trigger on user signup
-- 4. Updated RLS policies for profiles and communities
-- 5. User daily quotas table for rate limiting
-- 6. Helper functions for role checks

-- ============================================================================
-- PROFILES TABLE
-- Links Supabase auth.users to application user profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'standard' CHECK (role IN ('standard', 'creator', 'brand', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================================================
-- RLS POLICIES FOR PROFILES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    -- Prevent role escalation
  )
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    -- Cannot change role via RLS
  );

-- Public read NOT allowed (privacy - users can only see their own)
-- Role updates must be done via admin API using service role

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users with role-based access control';
COMMENT ON COLUMN profiles.role IS 'User role: standard, creator, brand, or admin';

-- ============================================================================
-- FUNCTION: Handle New User (Profile Creation Trigger)
-- Automatically creates a profile when a user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    'standard',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- FUNCTION: Get User Role
-- Helper function to get user role from auth context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE COMMUNITIES TABLE
-- Change created_by to reference profiles.id
-- ============================================================================

-- First, allow NULL for created_by during migration
ALTER TABLE communities 
  ALTER COLUMN created_by DROP NOT NULL;

-- If created_by is TEXT, we need to handle migration
-- Check if we need to convert existing TEXT values
-- For now, set existing values to NULL (safe default)
UPDATE communities 
SET created_by = NULL 
WHERE created_by IS NOT NULL AND created_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Change column type to UUID (will fail if any non-UUID values remain)
-- If there are issues, we can add a new column instead
DO $$
BEGIN
  -- Attempt to change type
  BEGIN
    ALTER TABLE communities 
      ALTER COLUMN created_by TYPE UUID 
      USING created_by::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, add new column and migrate
    ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    
    -- Copy valid UUID values
    UPDATE communities 
    SET owner_id = created_by::UUID 
    WHERE created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    -- Drop old column
    ALTER TABLE communities DROP COLUMN created_by;
    
    -- Rename new column
    ALTER TABLE communities RENAME COLUMN owner_id TO created_by;
  END;
END $$;

-- Add foreign key constraint
ALTER TABLE communities 
  DROP CONSTRAINT IF EXISTS fk_communities_created_by;
  
ALTER TABLE communities 
  ADD CONSTRAINT fk_communities_created_by 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON communities(created_by);

-- ============================================================================
-- UPDATE RLS POLICIES FOR COMMUNITIES
-- Replace overly permissive policies with role-based ones
-- ============================================================================

-- Drop old permissive policy
DROP POLICY IF EXISTS "Authenticated write access" ON communities;

-- Public read (keep existing)
-- Policy already exists from 017_communities.sql, no need to recreate

-- Brand or Admin can create communities (but must set created_by)
CREATE POLICY "Brand or admin can create communities" ON communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('brand', 'admin')
    )
    AND created_by = auth.uid() -- Must set self as owner
  );

-- Owner (brand) or admin can update
CREATE POLICY "Owner or admin can update communities" ON communities
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Only admin can delete
CREATE POLICY "Only admin can delete communities" ON communities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- UPDATE RLS POLICIES FOR COMMUNITY MEMBERSHIP TABLES
-- Restrict write access (only service role should write via functions)
-- ============================================================================

-- Remove overly permissive write policies
DROP POLICY IF EXISTS "Authenticated write access" ON community_video_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_hashtag_memberships;

-- Keep public read (needed for UI)
-- Policies already exist from 017_communities.sql

-- Note: Membership tables are managed by database functions (backfill, sync)
-- which use service role and bypass RLS. No direct user writes needed.

-- ============================================================================
-- USER DAILY QUOTAS TABLE
-- Tracks per-user daily usage for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_daily_quotas (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  video_submissions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_daily_quotas_date ON user_daily_quotas(date);
CREATE INDEX IF NOT EXISTS idx_user_daily_quotas_user_id ON user_daily_quotas(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_daily_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_daily_quotas_updated_at ON user_daily_quotas;
CREATE TRIGGER trigger_user_daily_quotas_updated_at
  BEFORE UPDATE ON user_daily_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_user_daily_quotas_updated_at();

-- RLS for quotas (users can read their own)
ALTER TABLE user_daily_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quotas" ON user_daily_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert/update handled by service role in API routes

COMMENT ON TABLE user_daily_quotas IS 'Daily usage quotas per user for rate limiting';
COMMENT ON COLUMN user_daily_quotas.video_submissions IS 'Number of video URL submissions today';

-- ============================================================================
-- FUNCTION: Increment Video Submission Quota
-- Atomically increments quota counter
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_video_submission_quota(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_current INTEGER;
BEGIN
  INSERT INTO user_daily_quotas (user_id, date, video_submissions)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    video_submissions = user_daily_quotas.video_submissions + 1,
    updated_at = NOW();
  
  SELECT video_submissions INTO v_current
  FROM user_daily_quotas
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  RETURN COALESCE(v_current, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get User Quota Status
-- Returns current quota usage for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_quota_status(p_user_id UUID, p_role TEXT)
RETURNS JSONB AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
  v_date DATE := CURRENT_DATE;
  v_allowed BOOLEAN;
BEGIN
  -- Set limit based on role
  CASE p_role
    WHEN 'admin' THEN v_limit := 999999; -- Effectively unlimited
    WHEN 'creator' THEN v_limit := 10;
    WHEN 'brand' THEN v_limit := 5;
    ELSE v_limit := 1; -- standard
  END CASE;
  
  -- Get current count (defaults to 0 if no row exists)
  SELECT COALESCE(video_submissions, 0) INTO v_current
  FROM user_daily_quotas
  WHERE user_id = p_user_id AND date = v_date;
  
  -- Ensure v_current is never NULL (in case SELECT found no rows)
  v_current := COALESCE(v_current, 0);
  
  -- Calculate allowed (ensure it's a proper boolean, not NULL)
  v_allowed := (v_current < v_limit);
  
  RETURN jsonb_build_object(
    'limit', v_limit,
    'current', v_current,
    'remaining', GREATEST(0, v_limit - v_current),
    'allowed', v_allowed,
    'date', v_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_quota_status IS 'Get quota status for a user based on their role';




-- ============================================================================
-- 031_fix_profile_trigger_error_handling.sql
-- ============================================================================

-- Fix Profile Creation Trigger to NOT Fail User Creation
-- The trigger was causing signup to fail with "Database error saving new user"
-- This version handles errors gracefully and allows signup to succeed even if profile creation fails

-- Drop and recreate with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to create profile, but don't fail if it errors
  BEGIN
    INSERT INTO profiles (id, email, role, email_verified)
    VALUES (
      NEW.id,
      NEW.email,
      'standard',
      COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    -- The signup API route will create the profile as fallback
    RAISE WARNING 'Failed to auto-create profile for user %: %', NEW.id, SQLERRM;
    -- Don't re-raise - allow user creation to succeed
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (it should already exist, but ensure it's correct)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Verify trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created';




-- ============================================================================
-- 014_rejected_videos.sql
-- ============================================================================

-- Rejected Videos Table
-- Stores videos that were rejected due to missing "edit" hashtag

-- ============================================================================
-- REJECTED_VIDEOS
-- Tracks videos that were rejected for quality control purposes
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejected_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tiktok_url TEXT NOT NULL,
  standardized_url TEXT NOT NULL UNIQUE,
  rejection_reason TEXT DEFAULT 'No "edit" hashtag found',
  original_data JSONB,
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  post_id TEXT,
  creator_id TEXT
);

-- Indexes for rejected_videos
CREATE INDEX IF NOT EXISTS idx_rejected_videos_standardized_url 
  ON rejected_videos(standardized_url);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_post_id 
  ON rejected_videos(post_id);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_rejected_at 
  ON rejected_videos(rejected_at DESC);

-- Comments
COMMENT ON TABLE rejected_videos IS 'Videos rejected for not containing "edit" in hashtags or other quality control reasons';
COMMENT ON COLUMN rejected_videos.standardized_url IS 'Normalized TikTok URL for duplicate detection';
COMMENT ON COLUMN rejected_videos.original_data IS 'Full JSON payload of the rejected video for debugging';




-- ============================================================================
-- 023_rejected_videos_enhancement.sql
-- ============================================================================

-- Migration: Enhanced Rejected Videos Schema
-- This migration adds structured columns to rejected_videos table
-- for easier querying and community membership tracking

-- ============================================================================
-- ADD STRUCTURED COLUMNS TO REJECTED_VIDEOS
-- ============================================================================

-- Add new columns for structured data
ALTER TABLE rejected_videos
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS total_views BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS comment_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hashtags TEXT[],
ADD COLUMN IF NOT EXISTS sound_id TEXT,
ADD COLUMN IF NOT EXISTS impact_score NUMERIC DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rejected_videos_video_id 
  ON rejected_videos(video_id);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_creator_id_enhanced 
  ON rejected_videos(creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rejected_videos_total_views 
  ON rejected_videos(total_views DESC);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_video_created_at 
  ON rejected_videos(video_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_hashtags 
  ON rejected_videos USING GIN(hashtags);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_sound_id 
  ON rejected_videos(sound_id) WHERE sound_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN rejected_videos.video_id IS 'Extracted video ID from original_data';
COMMENT ON COLUMN rejected_videos.title IS 'Video title/caption extracted from original_data';
COMMENT ON COLUMN rejected_videos.description IS 'Video description extracted from original_data';
COMMENT ON COLUMN rejected_videos.total_views IS 'View count at time of rejection';
COMMENT ON COLUMN rejected_videos.like_count IS 'Like count at time of rejection';
COMMENT ON COLUMN rejected_videos.comment_count IS 'Comment count at time of rejection';
COMMENT ON COLUMN rejected_videos.share_count IS 'Share count at time of rejection';
COMMENT ON COLUMN rejected_videos.video_created_at IS 'When the video was originally created on TikTok';
COMMENT ON COLUMN rejected_videos.hashtags IS 'Array of normalized hashtags from the video';
COMMENT ON COLUMN rejected_videos.sound_id IS 'Associated sound/music ID';
COMMENT ON COLUMN rejected_videos.impact_score IS 'Calculated impact score for the video';




-- ============================================================================
-- 024_submission_metadata.sql
-- ============================================================================

-- ============================================================================
-- SUBMISSION METADATA TABLE
-- Stores temporary metadata for video submissions (e.g., skip_validation flag)
-- Used to pass context from trigger API to webhook processing
-- ============================================================================

-- Create submission_metadata table
CREATE TABLE IF NOT EXISTS submission_metadata (
  snapshot_id TEXT PRIMARY KEY,
  video_urls TEXT[], -- Store URLs for lookup since snapshot_id may change
  skip_validation BOOLEAN DEFAULT FALSE,
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_submission_metadata_created 
  ON submission_metadata(created_at);

CREATE INDEX IF NOT EXISTS idx_submission_metadata_urls
  ON submission_metadata USING GIN(video_urls);

-- Index for user lookups (audit purposes)
CREATE INDEX IF NOT EXISTS idx_submission_metadata_user 
  ON submission_metadata(submitted_by);

-- Enable RLS
ALTER TABLE submission_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS submission_metadata_insert_policy ON submission_metadata;
DROP POLICY IF EXISTS submission_metadata_service_policy ON submission_metadata;

-- Policy: Only authenticated users can insert their own metadata
CREATE POLICY submission_metadata_insert_policy ON submission_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Policy: Service role can do anything (for webhook processing)
CREATE POLICY submission_metadata_service_policy ON submission_metadata
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- CLEANUP FUNCTION
-- Automatically delete metadata older than 7 days to prevent table bloat
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_submission_metadata()
RETURNS void AS $$
BEGIN
  DELETE FROM submission_metadata 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned up submission_metadata older than 7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_submission_metadata IS 'Delete submission metadata older than 7 days (run periodically)';

-- ============================================================================
-- SCHEDULED CLEANUP (Optional - requires pg_cron extension)
-- Uncomment if you want automatic cleanup
-- ============================================================================

-- SELECT cron.schedule(
--   'cleanup-submission-metadata',
--   '0 2 * * *',  -- Run daily at 2 AM
--   'SELECT cleanup_old_submission_metadata();'
-- );

COMMENT ON TABLE submission_metadata IS 'Temporary storage for submission context (e.g., validation bypass flags). Auto-cleaned after 7 days.';




-- ============================================================================
-- 023_admin_bypass_validation.sql
-- ============================================================================

-- ============================================================================
-- ADMIN BYPASS VALIDATION
-- Adds skip_validation parameter to ingestion function for admin uploads
-- ============================================================================

-- Drop the old function (with 3 parameters) to avoid conflicts
DROP FUNCTION IF EXISTS ingest_brightdata_snapshot_v2(TEXT, TEXT, JSONB);

-- Create the new function with the skip_validation parameter
CREATE OR REPLACE FUNCTION ingest_brightdata_snapshot_v2(
  p_snapshot_id TEXT,
  p_dataset_id TEXT,
  p_payload JSONB,
  p_skip_validation BOOLEAN DEFAULT FALSE  -- NEW: Allow admins to bypass hashtag validation
) RETURNS JSONB AS $$
DECLARE
  v_record JSONB;
  v_post_id TEXT;
  v_creator_id TEXT;
  v_sound_id TEXT;
  v_hashtag TEXT;
  v_results JSONB := '{"processed": 0, "errors": []}'::JSONB;
  v_processed_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_element JSONB;
  v_new_play_count INTEGER;
  v_old_play_count INTEGER := 0;
  v_delta INTEGER;
  -- Duplicate prevention variables
  v_video_url TEXT;
  v_standardized_url TEXT;
  v_is_already_rejected BOOLEAN := FALSE;
  -- Hashtag validation variables
  v_has_edit_hashtag BOOLEAN := FALSE;
  v_hashtag_check TEXT;
  -- Daily aggregation tracking variables
  v_old_likes INTEGER := 0;
  v_old_comments INTEGER := 0;
  v_old_shares INTEGER := 0;
  v_old_impact NUMERIC := 0;
  v_new_likes INTEGER;
  v_new_comments INTEGER;
  v_new_shares INTEGER;
  v_new_impact NUMERIC;
BEGIN
  -- Log start of ingestion
  RAISE NOTICE 'Starting ingestion for snapshot: % (skip_validation: %)', p_snapshot_id, p_skip_validation;
  
  -- Process each record in the payload
  FOR v_element IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    BEGIN
      -- Extract IDs from various possible field names
      v_post_id := COALESCE(
        v_element->>'post_id',
        v_element->>'id',
        v_element->>'video_id'
      );
      
      v_creator_id := COALESCE(
        v_element->>'profile_id',
        v_element->'author'->>'id',
        v_element->'profile'->>'id',
        v_element->>'author_id'
      );
      
      v_sound_id := COALESCE(
        v_element->'music'->>'id',
        v_element->'music'->>'music_id'
      );
      
      -- Skip if missing essential data
      IF v_post_id IS NULL OR v_creator_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'error', 'Missing post_id or creator_id',
          'element', v_element
        );
        CONTINUE;
      END IF;

      -- =======================================================================
      -- DUPLICATE PREVENTION - Check Rejected Videos (CONDITIONAL FOR ADMIN)
      -- =======================================================================
      v_video_url := v_element->>'url';
      
      -- Standardize URL (remove query params)
      v_standardized_url := regexp_replace(
        COALESCE(v_video_url, ''),
        '([\?&].*)?$',
        '',
        'g'
      );
      
      -- Only enforce duplicate prevention if NOT bypassing validation
      -- (Allow admins to rescue rejected videos)
      IF NOT p_skip_validation THEN
        v_is_already_rejected := EXISTS (
          SELECT 1 FROM rejected_videos 
          WHERE standardized_url = v_standardized_url
        );
        
        IF v_is_already_rejected THEN
          RAISE NOTICE 'Video % already rejected, skipping', v_post_id;
          CONTINUE;
        END IF;
      ELSE
        -- Admin bypass: Remove from rejected_videos if present (rescue the video)
        DELETE FROM rejected_videos 
        WHERE standardized_url = v_standardized_url;
        
        RAISE NOTICE 'Admin bypass: Rescued video % from rejected_videos', v_post_id;
      END IF;

      -- =======================================================================
      -- EDIT HASHTAG VALIDATION (CONDITIONAL - CAN BE BYPASSED BY ADMIN)
      -- =======================================================================
      IF NOT p_skip_validation THEN
        -- Standard validation: check for "edit" hashtag
        v_has_edit_hashtag := FALSE;
        
        -- Loop through hashtags to check for "edit"
        FOR v_hashtag_check IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
        LOOP
          v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
          
          -- Check if hashtag contains "edit" (case-insensitive, partial match)
          IF v_hashtag_check LIKE '%edit%' THEN
            v_has_edit_hashtag := TRUE;
            EXIT;  -- Found one, no need to check further
          END IF;
        END LOOP;
        
        -- If no "edit" hashtag found, reject and skip processing
        IF NOT v_has_edit_hashtag THEN
          -- Extract structured data for rejected_videos table
          DECLARE
            v_hashtags_array TEXT[];
            v_hashtag_text TEXT;
            v_rejected_views BIGINT;
            v_rejected_likes BIGINT;
            v_rejected_comments BIGINT;
            v_rejected_shares BIGINT;
            v_rejected_created_at TIMESTAMP WITH TIME ZONE;
            v_rejected_title TEXT;
            v_rejected_description TEXT;
            v_rejected_sound_id TEXT;
            v_rejected_impact NUMERIC;
          BEGIN
            -- Extract hashtags array
            SELECT ARRAY(
              SELECT LOWER(REPLACE(value::TEXT, '#', ''))
              FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
            ) INTO v_hashtags_array;
            
            -- Extract metrics
            v_rejected_views := COALESCE((v_element->>'play_count')::BIGINT, 0);
            v_rejected_likes := COALESCE((v_element->>'digg_count')::BIGINT, 0);
            v_rejected_comments := COALESCE((v_element->>'comment_count')::BIGINT, 0);
            v_rejected_shares := COALESCE((v_element->>'share_count')::BIGINT, 0);
            
            -- Extract video details
            v_rejected_title := COALESCE(v_element->>'description', v_element->>'caption', '');
            v_rejected_description := COALESCE(v_element->>'description', v_element->>'caption', '');
            v_rejected_sound_id := COALESCE(v_element->'music'->>'id', v_element->'music'->>'music_id');
            
            -- Extract created_at
            v_rejected_created_at := COALESCE(
              (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
              to_timestamp((v_element->>'createTime')::BIGINT)
            );
            
            -- Calculate impact score (same formula as videos_hot)
            v_rejected_impact := (
              COALESCE(v_rejected_views, 0) * 1.0 +
              COALESCE(v_rejected_likes, 0) * 10.0 +
              COALESCE(v_rejected_comments, 0) * 20.0 +
              COALESCE(v_rejected_shares, 0) * 30.0
            );
            
            -- Store rejected video with structured data
            INSERT INTO rejected_videos (
              tiktok_url,
              standardized_url,
              rejection_reason,
              original_data,
              post_id,
              creator_id,
              video_id,
              title,
              description,
              total_views,
              like_count,
              comment_count,
              share_count,
              video_created_at,
              hashtags,
              sound_id,
              impact_score
            )
            VALUES (
              v_video_url,
              v_standardized_url,
              'No "edit" hashtag found',
              v_element,
              v_post_id,
              v_creator_id,
              v_post_id,
              v_rejected_title,
              v_rejected_description,
              v_rejected_views,
              v_rejected_likes,
              v_rejected_comments,
              v_rejected_shares,
              v_rejected_created_at,
              v_hashtags_array,
              v_rejected_sound_id,
              v_rejected_impact
            )
            ON CONFLICT (standardized_url) DO UPDATE SET
              total_views = EXCLUDED.total_views,
              like_count = EXCLUDED.like_count,
              comment_count = EXCLUDED.comment_count,
              share_count = EXCLUDED.share_count,
              impact_score = EXCLUDED.impact_score,
              original_data = EXCLUDED.original_data;
            
            -- Check if this rejected video matches any community hashtags
            -- and add to community memberships
            DECLARE
              v_community RECORD;
            BEGIN
              FOR v_community IN 
                SELECT id, linked_hashtags 
                FROM communities 
                WHERE linked_hashtags && v_hashtags_array
              LOOP
                -- Add to community membership as non-edit video
                PERFORM update_community_video_membership_rejected(v_community.id, v_post_id);
              END LOOP;
            EXCEPTION
              WHEN undefined_function THEN
                -- Function not yet available, skip community membership
                NULL;
            END;
            
            -- Skip to next video
            RAISE NOTICE 'Rejected video % - no edit hashtag (added to % communities)', v_post_id, (
              SELECT COUNT(*) FROM communities WHERE linked_hashtags && v_hashtags_array
            );
            CONTINUE;
          END;
        END IF;
      ELSE
        -- Validation bypassed by admin
        RAISE NOTICE 'Validation bypassed by admin for video %', v_post_id;
      END IF;

      -- =======================================================================
      -- UPSERT CREATOR (HOT)
      -- =======================================================================
      INSERT INTO creators_hot (
        creator_id, username, display_name, avatar_url, verified,
        followers_count, bio, updated_at
      )
      VALUES (
        v_creator_id,
        COALESCE(
          v_element->'author'->>'unique_id',
          v_element->'profile'->>'unique_id',
          v_element->>'author_username',
          v_element->>'profile_username',
          v_element->>'account_id'
        ),
        COALESCE(
          v_element->'author'->>'nickname',
          v_element->'profile'->>'nickname',
          v_element->>'author_display_name'
        ),
        COALESCE(
          v_element->'author'->'avatar'->'url_list'->>0,
          v_element->'author'->>'avatar_url',
          v_element->'profile'->'avatar'->'url_list'->>0,
          v_element->>'profile_avatar'
        ),
        COALESCE((v_element->'author'->>'verified')::BOOLEAN, (v_element->>'is_verified')::BOOLEAN, FALSE),
        COALESCE((v_element->'author_stats'->>'follower_count')::INTEGER, (v_element->>'profile_followers')::INTEGER, 0),
        COALESCE(v_element->'author'->>'signature', v_element->>'profile_biography', ''),
        NOW()
      )
      ON CONFLICT (creator_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        verified = EXCLUDED.verified,
        followers_count = EXCLUDED.followers_count,
        bio = EXCLUDED.bio,
        updated_at = EXCLUDED.updated_at;

      -- =======================================================================
      -- UPSERT SOUND (HOT) - Only if sound_id exists
      -- =======================================================================
      IF v_sound_id IS NOT NULL THEN
        INSERT INTO sounds_hot (
          sound_id, sound_title, sound_author, music_duration, music_is_original
        )
        VALUES (
          v_sound_id,
          COALESCE(
            v_element->'music'->>'title',
            v_element->'music'->>'music_title',
            v_element->>'original_sound'
          ),
          COALESCE(
            v_element->'music'->>'authorname',
            v_element->'music'->>'authorName',
            v_element->'music'->>'music_author',
            v_element->>'account_id'
          ),
          COALESCE((v_element->'music'->>'duration')::INTEGER, 0),
          COALESCE((v_element->'music'->>'original')::BOOLEAN, FALSE)
        )
        ON CONFLICT (sound_id) DO UPDATE SET
          last_used_at = NOW(),
          updated_at = NOW();

      END IF;

      -- =======================================================================
      -- PREPARE NEW VALUES & FETCH OLD VALUES FOR DELTA CALCULATION
      -- =======================================================================
      -- Get new metrics from payload
      v_new_play_count := COALESCE((v_element->>'play_count')::INTEGER, 0);
      v_new_likes := COALESCE((v_element->>'digg_count')::INTEGER, 0);
      v_new_comments := COALESCE((v_element->>'comment_count')::INTEGER, 0);
      v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);

      -- Fetch previous play_count from history
      SELECT previous_play_count INTO v_old_play_count
      FROM video_play_count_history
      WHERE video_id = v_post_id;

      -- Fetch old values from existing video (for daily aggregation delta tracking)
      SELECT 
        like_count, 
        comment_count, 
        share_count, 
        COALESCE(impact_score, 0)
      INTO 
        v_old_likes, 
        v_old_comments, 
        v_old_shares, 
        v_old_impact
      FROM videos_hot
      WHERE video_id = v_post_id;

      -- If no history or video, set to 0 (this is a new video)
      IF v_old_play_count IS NULL THEN
        v_old_play_count := 0;
      END IF;
      IF v_old_likes IS NULL THEN
        v_old_likes := 0;
        v_old_comments := 0;
        v_old_shares := 0;
        v_old_impact := 0;
      END IF;

      -- Calculate delta
      v_delta := v_new_play_count - v_old_play_count;

      -- =======================================================================
      -- UPSERT VIDEO (HOT) - Use correct schema from 006_hot_tables.sql
      -- =======================================================================
      INSERT INTO videos_hot (
        video_id, post_id, creator_id, url, caption, description,
        created_at, total_views, like_count, comment_count,
        share_count, duration_seconds, video_url, cover_url
      )
      VALUES (
        v_post_id,
        v_post_id,
        v_creator_id,
        v_video_url,
        COALESCE(v_element->>'description', v_element->>'caption', ''),
        COALESCE(v_element->>'description', v_element->>'caption', ''),
        COALESCE(
          (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
          to_timestamp((v_element->>'createTime')::BIGINT)
        ),
        v_new_play_count,
        v_new_likes,
        v_new_comments,
        v_new_shares,
        COALESCE((v_element->>'video_duration')::INTEGER, (v_element->>'duration_seconds')::INTEGER, 0),
        COALESCE(v_element->>'video_url', ''),
        COALESCE(v_element->>'preview_image', v_element->>'cover_url', '')
      )
      ON CONFLICT (video_id) DO UPDATE SET
        total_views = EXCLUDED.total_views,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        share_count = EXCLUDED.share_count,
        last_seen_at = NOW(),
        updated_at = NOW();

      -- =======================================================================
      -- UPSERT COLD STORAGE DATA
      -- =======================================================================
      INSERT INTO videos_cold (video_id, full_json, raw_response)
      VALUES (
        v_post_id,
        v_element,
        v_element
      )
      ON CONFLICT (video_id) DO UPDATE SET
        full_json = EXCLUDED.full_json,
        raw_response = EXCLUDED.raw_response,
        updated_at = NOW();

      -- Insert creator cold storage
      BEGIN
        INSERT INTO creator_profiles_cold (creator_id, full_json)
        VALUES (v_creator_id, COALESCE(v_element->'author', v_element->'profile', '{}'::JSONB))
        ON CONFLICT (creator_id) DO UPDATE SET
          full_json = EXCLUDED.full_json,
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;

      -- Also populate creators_cold if it exists
      BEGIN
        INSERT INTO creators_cold (creator_id, full_json, raw_data)
        VALUES (v_creator_id, COALESCE(v_element->'author', v_element->'profile', '{}'::JSONB), v_element)
        ON CONFLICT (creator_id) DO UPDATE SET
          full_json = EXCLUDED.full_json,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;

      -- Insert sound cold storage if sound exists
      IF v_sound_id IS NOT NULL THEN
        BEGIN
          INSERT INTO sounds_cold (sound_id, full_json, music_details)
          VALUES (v_sound_id, v_element->'music', v_element->'music')
          ON CONFLICT (sound_id) DO UPDATE SET
            full_json = EXCLUDED.full_json,
            updated_at = NOW();
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END;
      END IF;

      -- =======================================================================
      -- UPDATE VIDEO PLAY COUNT HISTORY
      -- =======================================================================
      -- Update play count history for next ingestion (delta already calculated above)
      INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
      VALUES (v_post_id, v_new_play_count, NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        previous_play_count = EXCLUDED.previous_play_count,
        last_updated = NOW();

      -- =======================================================================
      -- UPDATE SOUND FACTS AND AGGREGATIONS (DELTA-BASED)
      -- =======================================================================
      -- Now that video exists, create sound fact relationship
      IF v_sound_id IS NOT NULL THEN
        -- Update sound's views_total with delta (if positive)
        IF v_delta > 0 THEN
          UPDATE sounds_hot
          SET views_total = COALESCE(views_total, 0) + v_delta,
              updated_at = NOW()
          WHERE sound_id = v_sound_id;
        END IF;

        -- Create fact relationship (video must exist first!)
        INSERT INTO video_sound_facts (video_id, sound_id, snapshot_at, views_at_snapshot, likes_at_snapshot)
        VALUES (
          v_post_id, 
          v_sound_id, 
          NOW(),
          v_new_play_count,
          v_new_likes
        )
        ON CONFLICT (video_id, sound_id) DO UPDATE SET
          snapshot_at = NOW(),
          views_at_snapshot = EXCLUDED.views_at_snapshot,
          likes_at_snapshot = EXCLUDED.likes_at_snapshot;
      END IF;

      -- =======================================================================
      -- UPDATE CREATOR AGGREGATIONS (DELTA-BASED)
      -- =======================================================================
      -- Update creator's total_play_count with delta (if positive)
      IF v_delta > 0 THEN
        UPDATE creators_hot
        SET total_play_count = COALESCE(total_play_count, 0) + v_delta,
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE creator_id = v_creator_id;
      ELSE
        -- Just update timestamps
        UPDATE creators_hot
        SET last_seen_at = NOW(),
            updated_at = NOW()
        WHERE creator_id = v_creator_id;
      END IF;

      -- =======================================================================
      -- PROCESS HASHTAGS WITH DELTA-BASED UPDATES
      -- =======================================================================
      FOR v_hashtag IN 
        SELECT value::TEXT 
        FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
      LOOP
        -- Normalize hashtag (remove #, lowercase)
        v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
        
        INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
        VALUES (v_hashtag, v_hashtag, NOW())
        ON CONFLICT (hashtag) DO UPDATE SET
          last_seen_at = NOW(),
          updated_at = NOW();

        -- Insert into hashtags_cold if it exists
        BEGIN
          INSERT INTO hashtags_cold (hashtag, raw_data)
          VALUES (v_hashtag, v_element)
          ON CONFLICT (hashtag) DO UPDATE SET
            updated_at = NOW();
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END;

        -- Create fact relationship
        INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
        VALUES (
          v_post_id,
          v_hashtag,
          NOW(),
          v_new_play_count,
          COALESCE((v_element->>'digg_count')::INTEGER, 0)
        )
        ON CONFLICT (video_id, hashtag) DO UPDATE SET
          snapshot_at = NOW(),
          views_at_snapshot = EXCLUDED.views_at_snapshot,
          likes_at_snapshot = EXCLUDED.likes_at_snapshot;

        -- Update hashtag's views_total with delta
        IF v_delta > 0 THEN
          UPDATE hashtags_hot
          SET views_total = COALESCE(views_total, 0) + v_delta,
              updated_at = NOW()
          WHERE hashtag = v_hashtag;
        END IF;
      END LOOP;

      -- =======================================================================
      -- UPDATE COMMUNITY MEMBERSHIPS FOR ACCEPTED VIDEOS
      -- =======================================================================
      BEGIN
        FOR v_hashtag IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
        LOOP
          -- Normalize hashtag
          v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
          
          -- Update communities that include this hashtag
          PERFORM update_community_video_membership(c.id, v_post_id)
          FROM communities c
          WHERE v_hashtag = ANY(c.linked_hashtags);
        END LOOP;
        
        -- Update community totals for all affected communities
        PERFORM update_community_totals(c.id)
        FROM communities c
        WHERE EXISTS (
          SELECT 1 FROM video_hashtag_facts vhf
          WHERE vhf.video_id = v_post_id
            AND vhf.hashtag = ANY(c.linked_hashtags)
        );
      EXCEPTION
        WHEN undefined_table OR undefined_function THEN
          -- Communities feature not yet implemented, skip silently
          NULL;
      END;

      -- =======================================================================
      -- UPDATE DAILY AGGREGATION STATS
      -- =======================================================================
      BEGIN
        -- Get the current impact_score from the newly updated video
        SELECT impact_score INTO v_new_impact
        FROM videos_hot
        WHERE video_id = v_post_id;
        
        -- Update daily aggregation tables (if function exists)
        PERFORM update_daily_aggregates_for_video(
          v_post_id,
          v_old_play_count,
          v_old_likes,
          v_old_comments,
          v_old_shares,
          v_old_impact
        );
      EXCEPTION
        WHEN undefined_function THEN
          -- Function doesn't exist yet, skip daily aggregation
          NULL;
      END;

      v_processed_count := v_processed_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'error', SQLERRM,
          'element', v_element
        );
    END;
  END LOOP;

  -- =======================================================================
  -- UPDATE FINAL AGGREGATIONS
  -- Update video counts, likes totals, and view counts for creators, sounds, and hashtags
  -- =======================================================================
  RAISE NOTICE 'Updating aggregations...';
  BEGIN
    PERFORM update_aggregations();
    RAISE NOTICE 'Aggregation update complete';
  EXCEPTION
    WHEN undefined_function THEN
      -- Function doesn't exist yet, skip
      RAISE NOTICE 'update_aggregations() function not available, skipping final aggregation';
  END;

  -- Log results (note: bd_ingestions table might not exist, wrap in exception handler)
  BEGIN
    INSERT INTO bd_ingestions (
      snapshot_id,
      dataset_id,
      status,
      processed_count,
      error,
      created_at,
      updated_at
    )
    VALUES (
      p_snapshot_id,
      p_dataset_id,
      'completed',
      v_processed_count,
      CASE 
        WHEN jsonb_array_length(v_errors) > 0 THEN v_errors::text
        ELSE NULL
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (snapshot_id) DO UPDATE SET
      status = 'completed',
      processed_count = EXCLUDED.processed_count,
      error = EXCLUDED.error,
      updated_at = NOW();
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist yet, skip logging
      NULL;
    WHEN undefined_column THEN
      -- Column doesn't exist, skip logging
      NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_processed_count,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ingest_brightdata_snapshot_v2 IS 'Process TikTok data into hot/cold storage pattern with optional validation bypass for admin uploads';




-- ============================================================================
-- 013_add_play_counts.sql
-- ============================================================================

-- Add total_play_count to creators_hot table
-- Add video_play_count_history tracking table
-- Add indexes for performance

-- ============================================================================
-- ADD TOTAL_PLAY_COUNT COLUMN
-- ============================================================================

ALTER TABLE creators_hot 
ADD COLUMN IF NOT EXISTS total_play_count BIGINT DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_creators_total_play_count 
ON creators_hot(total_play_count DESC);

COMMENT ON COLUMN creators_hot.total_play_count IS 'Sum of all videos total_views for this creator';

-- ============================================================================
-- STAGING TABLE FOR DELTA CALCULATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_play_count_history (
  video_id TEXT PRIMARY KEY REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  previous_play_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_play_history_video_id 
ON video_play_count_history(video_id);

COMMENT ON TABLE video_play_count_history IS 'Track previous play_count to calculate deltas and prevent overcounting';

-- ============================================================================
-- INITIALIZE TOTAL_PLAY_COUNT FROM EXISTING VIDEOS
-- ============================================================================

UPDATE creators_hot c
SET total_play_count = (
  SELECT COALESCE(SUM(total_views), 0)
  FROM videos_hot v
  WHERE v.creator_id = c.creator_id
);




-- ============================================================================
-- 012_aggregation.sql
-- ============================================================================

-- Aggregation Function to Update Counts
-- This function updates aggregate counts for creators, sounds, and hashtags

-- ============================================================================
-- UPDATE_AGGREGATIONS
-- Main function to update all aggregation tables after data ingestion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregations() RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_result JSONB := '{}'::JSONB;
  v_creators_updated INTEGER := 0;
  v_sounds_updated INTEGER := 0;
  v_hashtags_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation update...';

  -- =======================================================================
  -- UPDATE CREATOR COUNTS
  -- =======================================================================
  UPDATE creators_hot c
  SET 
    videos_count = (
      SELECT COUNT(*) 
      FROM videos_hot v 
      WHERE v.creator_id = c.creator_id
    ),
    likes_total = (
      SELECT COALESCE(SUM(like_count), 0) 
      FROM videos_hot v 
      WHERE v.creator_id = c.creator_id
    ),
    total_play_count = (
      SELECT COALESCE(SUM(total_views), 0)
      FROM videos_hot v
      WHERE v.creator_id = c.creator_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
  );
  
  GET DIAGNOSTICS v_creators_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % creators', v_creators_updated;

  -- =======================================================================
  -- UPDATE SOUND COUNTS
  -- =======================================================================
  UPDATE sounds_hot s
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_sound_facts vsf 
      WHERE vsf.sound_id = s.sound_id
    ),
    views_total = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
  );
  
  GET DIAGNOSTICS v_sounds_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % sounds', v_sounds_updated;

  -- =======================================================================
  -- UPDATE HASHTAG COUNTS
  -- =======================================================================
  UPDATE hashtags_hot h
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_hashtag_facts vhf 
      WHERE vhf.hashtag = h.hashtag
    ),
    creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    views_total = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    trend_score = (
      CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 3600 THEN views_total * 10.0 -- Recent activity
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 86400 THEN views_total * 5.0 -- Last 24h
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 604800 THEN views_total * 2.0 -- Last week
        ELSE views_total * 1.0
      END
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
  );
  
  GET DIAGNOSTICS v_hashtags_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % hashtags', v_hashtags_updated;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'creators_updated', v_creators_updated,
    'sounds_updated', v_sounds_updated,
    'hashtags_updated', v_hashtags_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_aggregations IS 'Update aggregate counts for creators, sounds, and hashtags';

-- ============================================================================
-- AUTOMATIC AGGREGATION TRIGGER
-- ============================================================================
-- Optionally, you can create triggers to automatically update counts
-- when data changes. This is commented out for now to avoid performance issues.

/*
CREATE OR REPLACE FUNCTION trigger_update_aggregations()
RETURNS TRIGGER AS $$
BEGIN
  -- Call update_aggregations() asynchronously or on a schedule
  -- For now, just log the change
  RAISE NOTICE 'Data changed, aggregation update recommended';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_video_insert
  AFTER INSERT ON videos_hot
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_aggregations();
*/

-- ============================================================================
-- QUICK AGGREGATION UPDATE (SELECTED TABLES ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregation_quick(
  p_table_name TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
BEGIN
  -- If no table specified, update all
  IF p_table_name IS NULL OR p_table_name = 'creators' THEN
    UPDATE creators_hot c
    SET 
      videos_count = (SELECT COUNT(*) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      likes_total = (SELECT COALESCE(SUM(like_count), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      total_play_count = (SELECT COALESCE(SUM(total_views), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      updated_at = NOW();
  END IF;

  IF p_table_name IS NULL OR p_table_name = 'sounds' THEN
    UPDATE sounds_hot s
    SET 
      videos_count = (SELECT COUNT(DISTINCT video_id) FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id),
      views_total = (SELECT COALESCE(SUM(v.total_views), 0) FROM video_sound_facts vsf JOIN videos_hot v ON v.video_id = vsf.video_id WHERE vsf.sound_id = s.sound_id),
      updated_at = NOW();
  END IF;

  IF p_table_name IS NULL OR p_table_name = 'hashtags' THEN
    UPDATE hashtags_hot h
    SET 
      videos_count = (SELECT COUNT(DISTINCT video_id) FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag),
      views_total = (SELECT COALESCE(SUM(v.total_views), 0) FROM video_hashtag_facts vhf JOIN videos_hot v ON v.video_id = vhf.video_id WHERE vhf.hashtag = h.hashtag),
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aggregation updated'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_aggregation_quick IS 'Quick update of specific aggregation tables';




-- ============================================================================
-- 015_add_missing_tables_columns.sql
-- ============================================================================

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




-- ============================================================================
-- 019_impact_score.sql
-- ============================================================================

-- ============================================================================
-- IMPACT SCORE IMPLEMENTATION
-- ============================================================================
-- This migration adds a comment-weighted Impact Score to complement existing
-- view-based rankings across videos, creators, hashtags, communities, and sounds.
--
-- Formula: Impact = 100 × comments + 0.1 × shares + 0.001 × likes + views ÷ 100000 + 0.1 × saves
-- ============================================================================

-- ============================================================================
-- PART 1: IMPACT SCORE COMPUTATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_impact(
  p_views INTEGER,
  p_likes INTEGER,
  p_comments INTEGER,
  p_shares INTEGER,
  p_saves INTEGER
) RETURNS NUMERIC AS $$
BEGIN
RETURN ROUND(
  100.0 * COALESCE(p_comments, 0)
  + 0.001 * COALESCE(p_likes, 0)
  + COALESCE(p_views, 0) / 100000.0
, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.compute_impact IS 'Compute Impact Score: 100×comments + 0.001×likes + views/100k';

-- ============================================================================
-- PART 2: ADD COLUMNS TO videos_hot
-- ============================================================================

ALTER TABLE public.videos_hot
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMENT ON COLUMN videos_hot.impact_score IS 'Comment-weighted impact score for ranking';
COMMENT ON COLUMN videos_hot.impact_updated_at IS 'Timestamp of last impact score update';

-- ============================================================================
-- PART 3: TRIGGER TO AUTO-UPDATE IMPACT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.videos_set_impact() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.impact_score := public.compute_impact(
    NEW.total_views,
    NEW.like_count,
    NEW.comment_count,
    NEW.share_count,
    NEW.save_count
  );
  NEW.impact_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_set_impact ON public.videos_hot;

CREATE TRIGGER trg_videos_set_impact
  BEFORE INSERT OR UPDATE OF total_views, like_count, comment_count, share_count, save_count
  ON public.videos_hot
  FOR EACH ROW 
  EXECUTE FUNCTION public.videos_set_impact();

-- ============================================================================
-- PART 4: INDEXES FOR IMPACT SCORE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_videos_impact_score_desc 
  ON public.videos_hot(impact_score DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_videos_creator_impact 
  ON public.videos_hot(creator_id, impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_videos_created_impact 
  ON public.videos_hot(created_at DESC, impact_score DESC);

-- ============================================================================
-- PART 5: ADD AGGREGATE COLUMNS
-- ============================================================================

-- Creators
ALTER TABLE public.creators_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creators_total_impact 
  ON public.creators_hot(total_impact_score DESC);

COMMENT ON COLUMN creators_hot.total_impact_score IS 'Sum of impact_score from all creator videos';

-- Sounds
ALTER TABLE public.sounds_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sounds_total_impact 
  ON public.sounds_hot(total_impact_score DESC);

COMMENT ON COLUMN sounds_hot.total_impact_score IS 'Sum of impact_score from all videos using this sound';

-- Hashtags
ALTER TABLE public.hashtags_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_hashtags_total_impact 
  ON public.hashtags_hot(total_impact_score DESC);

COMMENT ON COLUMN hashtags_hot.total_impact_score IS 'Sum of impact_score from all videos with this hashtag';

-- Communities
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_communities_total_impact 
  ON public.communities(total_impact_score DESC);

COMMENT ON COLUMN communities.total_impact_score IS 'Sum of impact_score from all community videos';

-- Community sub-tables
ALTER TABLE public.community_creator_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_creator_impact 
  ON public.community_creator_memberships(total_impact_score DESC);

ALTER TABLE public.community_hashtag_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_hashtag_impact 
  ON public.community_hashtag_memberships(total_impact_score DESC);

-- ============================================================================
-- PART 6: BACKFILL EXISTING VIDEOS
-- ============================================================================
-- Note: Run this AFTER the schema changes above
-- This will update all existing videos with their impact scores

DO $$
DECLARE
  v_total_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Get total count for reporting
  SELECT COUNT(*) INTO v_total_count FROM public.videos_hot;
  
  RAISE NOTICE 'Starting impact score backfill for % videos...', v_total_count;
  
  -- Update all videos
  UPDATE public.videos_hot
  SET 
    impact_score = public.compute_impact(
      total_views, 
      like_count, 
      comment_count, 
      share_count, 
      save_count
    ),
    impact_updated_at = NOW()
  WHERE TRUE;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Backfill complete: % videos updated', v_updated_count;
END $$;

-- Verify backfill
DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT 
    COUNT(*) as total_videos,
    COUNT(*) FILTER (WHERE impact_score > 0) as videos_with_impact,
    ROUND(AVG(impact_score), 2) as avg_impact,
    ROUND(MAX(impact_score), 2) as max_impact
  INTO v_result
  FROM videos_hot;
  
  RAISE NOTICE 'Backfill verification:';
  RAISE NOTICE '  Total videos: %', v_result.total_videos;
  RAISE NOTICE '  Videos with impact > 0: %', v_result.videos_with_impact;
  RAISE NOTICE '  Average impact: %', v_result.avg_impact;
  RAISE NOTICE '  Max impact: %', v_result.max_impact;
END $$;

-- ============================================================================
-- PART 7: UPDATE AGGREGATION FUNCTIONS
-- ============================================================================

-- Update the main aggregation function to include impact scores
CREATE OR REPLACE FUNCTION update_aggregations() RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_result JSONB := '{}'::JSONB;
  v_creators_updated INTEGER := 0;
  v_sounds_updated INTEGER := 0;
  v_hashtags_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation update with impact scores...';

  -- =======================================================================
  -- UPDATE CREATOR COUNTS (INCLUDING IMPACT)
  -- =======================================================================
  UPDATE creators_hot c
  SET 
    videos_count = (
      SELECT COUNT(*) 
      FROM videos_hot v 
      WHERE v.creator_id = c.creator_id
    ),
    likes_total = (
      SELECT COALESCE(SUM(like_count), 0) 
      FROM videos_hot v 
      WHERE v.creator_id = c.creator_id
    ),
    total_play_count = (
      SELECT COALESCE(SUM(total_views), 0)
      FROM videos_hot v
      WHERE v.creator_id = c.creator_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(impact_score), 0)
      FROM videos_hot v
      WHERE v.creator_id = c.creator_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
  );
  
  GET DIAGNOSTICS v_creators_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % creators', v_creators_updated;

  -- =======================================================================
  -- UPDATE SOUND COUNTS (INCLUDING IMPACT)
  -- =======================================================================
  UPDATE sounds_hot s
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_sound_facts vsf 
      WHERE vsf.sound_id = s.sound_id
    ),
    views_total = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
  );
  
  GET DIAGNOSTICS v_sounds_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % sounds', v_sounds_updated;

  -- =======================================================================
  -- UPDATE HASHTAG COUNTS (INCLUDING IMPACT)
  -- =======================================================================
  UPDATE hashtags_hot h
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_hashtag_facts vhf 
      WHERE vhf.hashtag = h.hashtag
    ),
    creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    views_total = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    trend_score = (
      CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 3600 THEN views_total * 10.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 86400 THEN views_total * 5.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 604800 THEN views_total * 2.0
        ELSE views_total * 1.0
      END
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
  );
  
  GET DIAGNOSTICS v_hashtags_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % hashtags', v_hashtags_updated;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'creators_updated', v_creators_updated,
    'sounds_updated', v_sounds_updated,
    'hashtags_updated', v_hashtags_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 8: UPDATE COMMUNITY FUNCTIONS
-- ============================================================================

-- Update community totals to include impact
CREATE OR REPLACE FUNCTION update_community_totals(p_community_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE communities
  SET 
    total_videos = (
      SELECT COUNT(DISTINCT video_id) 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    ),
    total_views = (
      SELECT COALESCE(SUM(v.total_views), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      SELECT COALESCE(SUM(v.like_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- Update community creator memberships to include impact
CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_creator_id IN 
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
  LOOP
    -- Count videos and sum metrics for this creator in this community
    SELECT 
      COUNT(*), 
      COALESCE(SUM(v.total_views), 0),
      COALESCE(SUM(v.impact_score), 0),
      MIN(v.created_at),
      MAX(v.created_at)
    INTO v_count, v_views, v_impact, v_first_video_at, v_last_video_at
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND v.creator_id = v_creator_id;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, total_impact_score,
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_impact, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update community hashtag memberships to include impact
CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community, but only for hashtags in linked_hashtags
  FOR v_hashtag IN 
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum metrics for this hashtag in this community
    SELECT COUNT(*), COALESCE(SUM(v.total_views), 0), COALESCE(SUM(v.impact_score), 0)
    INTO v_count, v_views, v_impact
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag = v_hashtag;
    
    -- Insert the recalculated membership
    INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, total_impact_score, joined_at, last_updated)
    VALUES (p_community_id, v_hashtag, v_count, v_views, v_impact, NOW(), NOW());
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 9: RECONCILIATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_impact_scores(p_days_back INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP := NOW();
  v_videos_updated INTEGER;
  v_cutoff TIMESTAMP := NOW() - (p_days_back || ' days')::INTERVAL;
BEGIN
  -- Recompute impact for recently updated videos
  UPDATE videos_hot
  SET 
    impact_score = compute_impact(total_views, like_count, comment_count, share_count, save_count),
    impact_updated_at = NOW()
  WHERE updated_at >= v_cutoff;
  
  GET DIAGNOSTICS v_videos_updated = ROW_COUNT;
  
  -- Refresh aggregates
  PERFORM update_aggregations();
  
  RETURN jsonb_build_object(
    'success', true,
    'videos_reconciled', v_videos_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reconcile_impact_scores IS 'Recomputes impact scores for recently updated videos and refreshes aggregates';

-- ============================================================================
-- PART 10: BACKFILL AGGREGATES
-- ============================================================================

DO $$
DECLARE
  v_result JSONB;
  v_comm RECORD;
  v_comm_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregate backfill...';
  
  -- Run the updated aggregation function
  SELECT update_aggregations() INTO v_result;
  RAISE NOTICE 'Aggregation result: %', v_result;
  
  -- Backfill all communities
  FOR v_comm IN SELECT id FROM communities LOOP
    PERFORM update_community_totals(v_comm.id);
    PERFORM recalculate_community_creator_memberships(v_comm.id);
    PERFORM recalculate_community_hashtag_memberships(v_comm.id);
    v_comm_count := v_comm_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated % communities', v_comm_count;
  RAISE NOTICE 'Aggregate backfill complete!';
END $$;

-- ============================================================================
-- PART 11: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE '=== Impact Score Implementation Verification ===';
  
  -- Creators
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM creators_hot;
  RAISE NOTICE 'Creators: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Sounds
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM sounds_hot;
  RAISE NOTICE 'Sounds: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Hashtags
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM hashtags_hot;
  RAISE NOTICE 'Hashtags: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Communities
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM communities;
  RAISE NOTICE 'Communities: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  RAISE NOTICE '=== Verification Complete ===';
END $$;




-- ============================================================================
-- 020_daily_aggregation_tables.sql
-- ============================================================================

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




-- ============================================================================
-- 021_daily_aggregation_functions.sql
-- ============================================================================

-- Daily Aggregation Functions for Time-Based Rankings
-- Functions to update daily stats on video ingestion and query time-windowed data

-- ============================================================================
-- PART 1: INGESTION-TIME UPDATE FUNCTION
-- Updates daily stats when videos are inserted or updated
-- ============================================================================

CREATE OR REPLACE FUNCTION update_daily_aggregates_for_video(
  p_video_id TEXT,
  p_old_views INTEGER DEFAULT 0,
  p_old_likes INTEGER DEFAULT 0,
  p_old_comments INTEGER DEFAULT 0,
  p_old_shares INTEGER DEFAULT 0,
  p_old_impact NUMERIC DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  v_video RECORD;
  v_video_date DATE;
  v_views_delta INTEGER;
  v_likes_delta INTEGER;
  v_comments_delta INTEGER;
  v_shares_delta INTEGER;
  v_impact_delta NUMERIC;
  v_is_new_video BOOLEAN;
  v_hashtag TEXT;
  v_sound_id TEXT;
  v_community_id UUID;
BEGIN
  -- Get video details
  SELECT 
    video_id, 
    creator_id, 
    created_at::DATE as video_date,
    total_views,
    like_count,
    comment_count,
    share_count,
    impact_score
  INTO v_video
  FROM videos_hot
  WHERE video_id = p_video_id;
  
  -- If video not found, exit
  IF v_video.video_id IS NULL THEN
    RAISE NOTICE 'Video % not found, skipping daily aggregation', p_video_id;
    RETURN;
  END IF;
  
  -- Determine if this is a new video or update
  v_is_new_video := (p_old_views = 0 AND p_old_likes = 0);
  
  -- Calculate deltas
  v_views_delta := v_video.total_views - p_old_views;
  v_likes_delta := v_video.like_count - p_old_likes;
  v_comments_delta := v_video.comment_count - p_old_comments;
  v_shares_delta := v_video.share_count - p_old_shares;
  v_impact_delta := v_video.impact_score - p_old_impact;
  
  v_video_date := v_video.video_date;
  
  -- ==========================================================================
  -- UPDATE CREATOR DAILY STATS
  -- ==========================================================================
  INSERT INTO creator_daily_stats (
    creator_id, 
    date, 
    videos_count, 
    views_total, 
    likes_total, 
    comments_total,
    shares_total,
    impact_score_total
  )
  VALUES (
    v_video.creator_id, 
    v_video_date,
    CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
    v_views_delta,
    v_likes_delta,
    v_comments_delta,
    v_shares_delta,
    v_impact_delta
  )
  ON CONFLICT (creator_id, date) DO UPDATE SET
    videos_count = creator_daily_stats.videos_count + EXCLUDED.videos_count,
    views_total = creator_daily_stats.views_total + EXCLUDED.views_total,
    likes_total = creator_daily_stats.likes_total + EXCLUDED.likes_total,
    comments_total = creator_daily_stats.comments_total + EXCLUDED.comments_total,
    shares_total = creator_daily_stats.shares_total + EXCLUDED.shares_total,
    impact_score_total = creator_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  -- ==========================================================================
  -- UPDATE HASHTAG DAILY STATS
  -- ==========================================================================
  -- For each hashtag on this video
  FOR v_hashtag IN 
    SELECT DISTINCT hashtag 
    FROM video_hashtag_facts 
    WHERE video_id = p_video_id
  LOOP
    INSERT INTO hashtag_daily_stats (
      hashtag, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_hashtag,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (hashtag, date) DO UPDATE SET
      videos_count = hashtag_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = hashtag_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = hashtag_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = hashtag_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
  END LOOP;
  
  -- Update creators_count for hashtags (recalculate for this date)
  -- Only for new videos to avoid double counting
  IF v_is_new_video THEN
    UPDATE hashtag_daily_stats hds
    SET creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = hds.hashtag
        AND v.created_at::DATE = hds.date
    )
    WHERE date = v_video_date
      AND hashtag IN (
        SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id
      );
  END IF;
  
  -- ==========================================================================
  -- UPDATE SOUND DAILY STATS
  -- ==========================================================================
  -- Get sound_id for this video
  SELECT sound_id INTO v_sound_id
  FROM video_sound_facts
  WHERE video_id = p_video_id
  LIMIT 1;
  
  IF v_sound_id IS NOT NULL THEN
    INSERT INTO sound_daily_stats (
      sound_id, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_sound_id,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (sound_id, date) DO UPDATE SET
      videos_count = sound_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = sound_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = sound_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = sound_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
    
    -- Update creators_count for this sound (recalculate for this date)
    IF v_is_new_video THEN
      UPDATE sound_daily_stats sds
      SET creators_count = (
        SELECT COUNT(DISTINCT v.creator_id)
        FROM video_sound_facts vsf
        JOIN videos_hot v ON v.video_id = vsf.video_id
        WHERE vsf.sound_id = sds.sound_id
          AND v.created_at::DATE = sds.date
      )
      WHERE date = v_video_date
        AND sound_id = v_sound_id;
    END IF;
  END IF;
  
  -- ==========================================================================
  -- UPDATE COMMUNITY DAILY STATS
  -- ==========================================================================
  -- For each community linked to this video's hashtags
  FOR v_community_id IN 
    SELECT DISTINCT c.id
    FROM communities c
    CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
    WHERE lh IN (SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id)
  LOOP
    INSERT INTO community_daily_stats (
      community_id, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_community_id,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (community_id, date) DO UPDATE SET
      videos_count = community_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = community_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = community_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = community_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
  END LOOP;
  
  -- Update creators_count for communities (recalculate for this date)
  IF v_is_new_video THEN
    UPDATE community_daily_stats cds
    SET creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM communities c
      CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
      JOIN video_hashtag_facts vhf ON vhf.hashtag = lh
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE c.id = cds.community_id
        AND v.created_at::DATE = cds.date
    )
    WHERE date = v_video_date
      AND community_id IN (
        SELECT c.id
        FROM communities c
        CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
        WHERE lh IN (SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id)
      );
  END IF;
  
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_daily_aggregates_for_video IS 'Updates daily aggregation tables when a video is inserted or updated. Handles out-of-order ingestion by bucketing into correct date.';

-- ============================================================================
-- PART 2: QUERY FUNCTIONS FOR TIME-RANGE FILTERING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GET HASHTAGS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_hashtags_by_timerange(
  p_days INTEGER DEFAULT NULL,  -- NULL = all time, 7 = last 7 days, etc.
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'alphabetical'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  hashtag TEXT,
  hashtag_norm TEXT,
  videos_count INTEGER,
  creators_count INTEGER,
  views_total BIGINT,
  likes_total BIGINT,
  total_impact_score NUMERIC,
  trending BOOLEAN
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      h.hashtag,
      h.hashtag_norm,
      h.videos_count::INTEGER,
      h.creators_count::INTEGER,
      h.views_total::BIGINT,
      h.likes_total::BIGINT,
      h.total_impact_score,
      (h.trend_score > 100000) as trending
    FROM hashtags_hot h
    WHERE (p_search IS NULL OR h.hashtag ILIKE '%' || p_search || '%' OR h.hashtag_norm ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN h.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN h.views_total END DESC,
      CASE WHEN p_sort_by = 'videos' THEN h.videos_count END DESC,
      CASE WHEN p_sort_by = 'alphabetical' THEN h.hashtag_norm END ASC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      h.hashtag,
      h.hashtag_norm,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(MAX(ds.creators_count)::INTEGER, 0) as creators_count, -- Max to avoid double counting
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as views_total,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      FALSE as trending -- Not computed for time windows
    FROM hashtags_hot h
    LEFT JOIN hashtag_daily_stats ds ON ds.hashtag = h.hashtag
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE  -- Exclude today (partial data)
    WHERE (p_search IS NULL OR h.hashtag ILIKE '%' || p_search || '%' OR h.hashtag_norm ILIKE '%' || p_search || '%')
    GROUP BY h.hashtag, h.hashtag_norm
    HAVING SUM(ds.videos_count) > 0  -- Only show hashtags with activity in timeframe
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'alphabetical' THEN h.hashtag_norm END ASC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hashtags_by_timerange IS 'Get hashtags with metrics filtered by time range. NULL days = all time, uses hot tables. Otherwise aggregates from daily stats.';

-- ----------------------------------------------------------------------------
-- GET CREATORS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_creators_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'followers'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  creator_id TEXT,
  username TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  followers_count INTEGER,
  videos_count INTEGER,
  likes_total BIGINT,
  total_play_count BIGINT,
  total_impact_score NUMERIC
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.bio,
      c.avatar_url,
      c.verified,
      c.followers_count::INTEGER,
      c.videos_count::INTEGER,
      c.likes_total::BIGINT,
      c.total_play_count::BIGINT,
      c.total_impact_score
    FROM creators_hot c
    WHERE (p_search IS NULL OR 
           c.username ILIKE '%' || p_search || '%' OR 
           c.display_name ILIKE '%' || p_search || '%' OR 
           c.bio ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN c.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN c.total_play_count END DESC,
      CASE WHEN p_sort_by = 'followers' THEN c.followers_count END DESC,
      CASE WHEN p_sort_by = 'videos' THEN c.videos_count END DESC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.bio,
      c.avatar_url,
      c.verified,
      c.followers_count::INTEGER, -- Current followers (not time-dependent)
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as total_play_count,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score
    FROM creators_hot c
    LEFT JOIN creator_daily_stats ds ON ds.creator_id = c.creator_id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           c.username ILIKE '%' || p_search || '%' OR 
           c.display_name ILIKE '%' || p_search || '%' OR 
           c.bio ILIKE '%' || p_search || '%')
    GROUP BY c.creator_id, c.username, c.display_name, c.bio, c.avatar_url, c.verified, c.followers_count
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'followers' THEN c.followers_count END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_creators_by_timerange IS 'Get creators with metrics filtered by time range. NULL days = all time.';

-- ----------------------------------------------------------------------------
-- GET SOUNDS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sounds_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'likes', 'recent'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  sound_id TEXT,
  sound_title TEXT,
  sound_author TEXT,
  music_duration INTEGER,
  cover_url TEXT,
  videos_count INTEGER,
  views_total BIGINT,
  likes_total BIGINT,
  total_impact_score NUMERIC,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.music_duration::INTEGER,
      s.cover_url,
      s.videos_count::INTEGER,
      s.views_total::BIGINT,
      s.likes_total::BIGINT,
      s.total_impact_score,
      s.last_used_at
    FROM sounds_hot s
    WHERE (p_search IS NULL OR 
           s.sound_title ILIKE '%' || p_search || '%' OR 
           s.sound_author ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN s.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN s.views_total END DESC,
      CASE WHEN p_sort_by = 'videos' THEN s.videos_count END DESC,
      CASE WHEN p_sort_by = 'likes' THEN s.likes_total END DESC,
      CASE WHEN p_sort_by = 'recent' THEN s.last_used_at END DESC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.music_duration::INTEGER,
      s.cover_url,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as views_total,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      s.last_used_at -- Current last_used_at (not filtered by time)
    FROM sounds_hot s
    LEFT JOIN sound_daily_stats ds ON ds.sound_id = s.sound_id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           s.sound_title ILIKE '%' || p_search || '%' OR 
           s.sound_author ILIKE '%' || p_search || '%')
    GROUP BY s.sound_id, s.sound_title, s.sound_author, s.music_duration, s.cover_url, s.last_used_at
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'likes' THEN SUM(ds.likes_total) END DESC,
      CASE WHEN p_sort_by = 'recent' THEN s.last_used_at END DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sounds_by_timerange IS 'Get sounds with metrics filtered by time range. NULL days = all time.';

-- ----------------------------------------------------------------------------
-- GET COMMUNITIES BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_communities_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'creators'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  linked_hashtags TEXT[],
  profile_image_url TEXT,
  cover_image_url TEXT,
  links JSONB,
  total_videos INTEGER,
  total_creators INTEGER,
  total_views BIGINT,
  total_likes BIGINT,
  total_impact_score NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- All-time query: Use pre-computed community totals
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.linked_hashtags,
      c.profile_image_url,
      c.cover_image_url,
      c.links,
      c.total_videos::INTEGER,
      c.total_creators::INTEGER,
      c.total_views::BIGINT,
      c.total_likes::BIGINT,
      c.total_impact_score,
      c.created_at,
      c.updated_at
    FROM communities c
    WHERE (p_search IS NULL OR 
           c.name ILIKE '%' || p_search || '%' OR 
           c.description ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN c.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN c.total_views END DESC,
      CASE WHEN p_sort_by = 'videos' THEN c.total_videos END DESC,
      CASE WHEN p_sort_by = 'creators' THEN c.total_creators END DESC
    LIMIT p_limit
    OFFSET p_offset;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.linked_hashtags,
      c.profile_image_url,
      c.cover_image_url,
      c.links,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as total_videos,
      COALESCE(MAX(ds.creators_count)::INTEGER, 0) as total_creators,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as total_views,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as total_likes,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      c.created_at,
      c.updated_at
    FROM communities c
    LEFT JOIN community_daily_stats ds ON ds.community_id = c.id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           c.name ILIKE '%' || p_search || '%' OR 
           c.description ILIKE '%' || p_search || '%')
    GROUP BY c.id, c.name, c.slug, c.description, c.linked_hashtags, 
             c.profile_image_url, c.cover_image_url, c.links, c.created_at, c.updated_at
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'creators' THEN MAX(ds.creators_count) END DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_communities_by_timerange IS 'Get communities with metrics filtered by time range. NULL days = all time.';




-- ============================================================================
-- 022_backfill_daily_stats.sql
-- ============================================================================

-- Backfill Script for Daily Aggregation Tables
-- One-time function to populate historical daily stats from existing videos
-- Only backfills last 365 days (sufficient for supported time ranges)

-- ============================================================================
-- BACKFILL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_daily_stats(
  p_days_back INTEGER DEFAULT 365
) RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP := NOW();
  v_cutoff_date DATE;
  v_hashtags_inserted INTEGER := 0;
  v_creators_inserted INTEGER := 0;
  v_sounds_inserted INTEGER := 0;
  v_communities_inserted INTEGER := 0;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := CURRENT_DATE - (p_days_back || ' days')::INTERVAL;
  
  RAISE NOTICE 'Starting backfill for videos created since %', v_cutoff_date;
  
  -- ==========================================================================
  -- BACKFILL CREATOR DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling creator daily stats...';
  
  INSERT INTO creator_daily_stats (
    creator_id,
    date,
    videos_count,
    views_total,
    likes_total,
    comments_total,
    shares_total,
    impact_score_total
  )
  SELECT 
    v.creator_id,
    v.created_at::DATE as date,
    COUNT(*) as videos_count,
    COALESCE(SUM(v.total_views), 0) as views_total,
    COALESCE(SUM(v.like_count), 0) as likes_total,
    COALESCE(SUM(v.comment_count), 0) as comments_total,
    COALESCE(SUM(v.share_count), 0) as shares_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM videos_hot v
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY v.creator_id, v.created_at::DATE
  ON CONFLICT (creator_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    comments_total = EXCLUDED.comments_total,
    shares_total = EXCLUDED.shares_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_creators_inserted = ROW_COUNT;
  RAISE NOTICE 'Creator daily stats: % rows', v_creators_inserted;
  
  -- ==========================================================================
  -- BACKFILL HASHTAG DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling hashtag daily stats...';
  
  INSERT INTO hashtag_daily_stats (
    hashtag,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    vhf.hashtag,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.total_views), 0) as views_total,
    COALESCE(SUM(v.like_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM video_hashtag_facts vhf
  JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY vhf.hashtag, v.created_at::DATE
  ON CONFLICT (hashtag, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_hashtags_inserted = ROW_COUNT;
  RAISE NOTICE 'Hashtag daily stats: % rows', v_hashtags_inserted;
  
  -- ==========================================================================
  -- BACKFILL SOUND DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling sound daily stats...';
  
  INSERT INTO sound_daily_stats (
    sound_id,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    vsf.sound_id,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.total_views), 0) as views_total,
    COALESCE(SUM(v.like_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY vsf.sound_id, v.created_at::DATE
  ON CONFLICT (sound_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_sounds_inserted = ROW_COUNT;
  RAISE NOTICE 'Sound daily stats: % rows', v_sounds_inserted;
  
  -- ==========================================================================
  -- BACKFILL COMMUNITY DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling community daily stats...';
  
  INSERT INTO community_daily_stats (
    community_id,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    c.id as community_id,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.total_views), 0) as views_total,
    COALESCE(SUM(v.like_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM communities c
  CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
  JOIN video_hashtag_facts vhf ON vhf.hashtag = lh
  JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY c.id, v.created_at::DATE
  ON CONFLICT (community_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_communities_inserted = ROW_COUNT;
  RAISE NOTICE 'Community daily stats: % rows', v_communities_inserted;
  
  -- ==========================================================================
  -- RETURN SUMMARY
  -- ==========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'days_backfilled', p_days_back,
    'cutoff_date', v_cutoff_date,
    'creator_stats_rows', v_creators_inserted,
    'hashtag_stats_rows', v_hashtags_inserted,
    'sound_stats_rows', v_sounds_inserted,
    'community_stats_rows', v_communities_inserted,
    'total_rows', v_creators_inserted + v_hashtags_inserted + v_sounds_inserted + v_communities_inserted,
    'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))::INTEGER
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_daily_stats IS 'One-time backfill function to populate daily aggregation tables from existing videos. Run after creating tables: SELECT backfill_daily_stats(365);';

-- ============================================================================
-- VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_daily_stats()
RETURNS TABLE (
  table_name TEXT,
  total_rows BIGINT,
  earliest_date DATE,
  latest_date DATE,
  unique_entities BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'creator_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT creator_id)::BIGINT
  FROM creator_daily_stats
  
  UNION ALL
  
  SELECT 
    'hashtag_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT hashtag)::BIGINT
  FROM hashtag_daily_stats
  
  UNION ALL
  
  SELECT 
    'sound_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT sound_id)::BIGINT
  FROM sound_daily_stats
  
  UNION ALL
  
  SELECT 
    'community_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT community_id)::BIGINT
  FROM community_daily_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_daily_stats IS 'Verification function to check daily stats tables. Run after backfill: SELECT * FROM verify_daily_stats();';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

/*
TO RUN BACKFILL:

1. Create tables:
   \i sql/020_daily_aggregation_tables.sql

2. Create functions:
   \i sql/021_daily_aggregation_functions.sql

3. Run this file:
   \i sql/022_backfill_daily_stats.sql

4. Execute backfill (365 days):
   SELECT backfill_daily_stats(365);

5. Verify results:
   SELECT * FROM verify_daily_stats();

Expected output shows:
- creator_daily_stats: thousands of rows
- hashtag_daily_stats: thousands of rows
- sound_daily_stats: thousands of rows  
- community_daily_stats: hundreds/thousands of rows

Runtime: 5-30 minutes for 100K videos

NOTE: This is a one-time operation. After running, the update_daily_aggregates_for_video()
function will keep the tables updated in real-time as videos are ingested.
*/




-- ============================================================================
-- 024_community_membership_edit_flag.sql
-- ============================================================================

-- Migration: Add Edit Video Flag to Community Memberships
-- This migration adds is_edit_video flag to distinguish between
-- edit videos (from videos_hot) and non-edit videos (from rejected_videos)

-- ============================================================================
-- REMOVE FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Drop the foreign key constraint since video_id can now reference either
-- videos_hot (edit videos) or rejected_videos (non-edit videos)
ALTER TABLE community_video_memberships
DROP CONSTRAINT IF EXISTS community_video_memberships_video_id_fkey;

-- ============================================================================
-- ADD IS_EDIT_VIDEO FLAG TO COMMUNITY_VIDEO_MEMBERSHIPS
-- ============================================================================

-- Add column to track whether this is an edit video or non-edit video
ALTER TABLE community_video_memberships
ADD COLUMN IF NOT EXISTS is_edit_video BOOLEAN DEFAULT TRUE NOT NULL;

-- Create composite index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_community_video_is_edit 
  ON community_video_memberships(community_id, is_edit_video);

-- Create index for non-edit video queries
CREATE INDEX IF NOT EXISTS idx_community_video_non_edit 
  ON community_video_memberships(community_id) 
  WHERE is_edit_video = FALSE;

-- Update comment
COMMENT ON COLUMN community_video_memberships.is_edit_video IS 
  'TRUE for edit videos (from videos_hot), FALSE for non-edit videos (from rejected_videos)';

-- Note: Existing rows will default to TRUE (edit videos)
-- since all current memberships are from videos_hot

-- Note: We intentionally do NOT add foreign keys to videos_hot or rejected_videos
-- because video_id can reference either table depending on is_edit_video flag




-- ============================================================================
-- 025_community_rejected_video_functions.sql
-- ============================================================================

-- Migration: Community Rejected Video Functions
-- This migration adds functions to handle non-edit videos (rejected videos)
-- in community memberships

-- ============================================================================
-- HELPER FUNCTION: check_rejected_video_community_match
-- Returns TRUE if a rejected video's hashtags intersect with a community's linked_hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rejected_video_community_match(
  p_video_id TEXT,
  p_community_hashtags TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM rejected_videos rv
    WHERE rv.video_id = p_video_id
      AND rv.hashtags && p_community_hashtags
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_rejected_video_community_match IS 
  'Check if a rejected video matches a community based on hashtags';

-- ============================================================================
-- FUNCTION: update_community_video_membership_rejected
-- Adds or removes a rejected video from a community based on hashtag match
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_video_membership_rejected(
  p_community_id UUID,
  p_video_id TEXT
) RETURNS void AS $$
DECLARE
  v_matches BOOLEAN;
  v_total_views BIGINT;
  v_creator_id TEXT;
  v_video_hashtags TEXT[];
  v_hashtag TEXT;
  v_community_hashtags TEXT[];
BEGIN
  -- Get video details from rejected_videos
  SELECT total_views, creator_id, hashtags 
  INTO v_total_views, v_creator_id, v_video_hashtags
  FROM rejected_videos
  WHERE video_id = p_video_id;
  
  -- If video not found, exit
  IF v_creator_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get community hashtags
  SELECT linked_hashtags INTO v_community_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  -- Check if video matches community
  v_matches := v_video_hashtags && v_community_hashtags;
  
  IF v_matches THEN
    -- Add/update membership (marked as non-edit video)
    INSERT INTO community_video_memberships (community_id, video_id, is_edit_video)
    VALUES (p_community_id, p_video_id, FALSE)
    ON CONFLICT (community_id, video_id) DO UPDATE SET
      last_updated = NOW(),
      is_edit_video = FALSE;
    
    -- Update creator membership
    INSERT INTO community_creator_memberships (community_id, creator_id, total_views, video_count)
    VALUES (p_community_id, v_creator_id, COALESCE(v_total_views, 0), 1)
    ON CONFLICT (community_id, creator_id) DO UPDATE SET
      total_views = community_creator_memberships.total_views + EXCLUDED.total_views,
      video_count = community_creator_memberships.video_count + 1,
      last_video_at = NOW(),
      last_updated = NOW();
    
    -- Update hashtag memberships for each matching hashtag
    FOR v_hashtag IN 
      SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      WHERE hashtag = ANY(v_community_hashtags)
    LOOP
      INSERT INTO community_hashtag_memberships (community_id, hashtag, total_views, video_count)
      VALUES (p_community_id, v_hashtag, COALESCE(v_total_views, 0), 1)
      ON CONFLICT (community_id, hashtag) DO UPDATE SET
        total_views = community_hashtag_memberships.total_views + EXCLUDED.total_views,
        video_count = community_hashtag_memberships.video_count + 1,
        last_used_at = NOW(),
        last_updated = NOW();
    END LOOP;
  ELSE
    -- Remove membership if no hashtags match
    DELETE FROM community_video_memberships
    WHERE community_id = p_community_id 
      AND video_id = p_video_id 
      AND is_edit_video = FALSE;
    
    -- Update creator membership (decrement)
    UPDATE community_creator_memberships
    SET total_views = GREATEST(0, total_views - COALESCE(v_total_views, 0)),
        video_count = GREATEST(0, video_count - 1),
        last_updated = NOW()
    WHERE community_id = p_community_id AND creator_id = v_creator_id;
    
    -- Update hashtag memberships (decrement for all video hashtags)
    FOR v_hashtag IN SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
    LOOP
      UPDATE community_hashtag_memberships
      SET total_views = GREATEST(0, total_views - COALESCE(v_total_views, 0)),
          video_count = GREATEST(0, video_count - 1),
          last_updated = NOW()
      WHERE community_id = p_community_id AND hashtag = v_hashtag;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_community_video_membership_rejected IS 
  'Add or remove a rejected video from community memberships based on hashtag match';

-- ============================================================================
-- FUNCTION: backfill_community_rejected_videos
-- Backfills a community's memberships from existing rejected videos
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_community_rejected_videos(p_community_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hashtags TEXT[];
  v_video RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get community hashtags
  SELECT linked_hashtags INTO v_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No hashtags linked to community');
  END IF;
  
  -- Process each rejected video that matches
  FOR v_video IN 
    SELECT DISTINCT rv.video_id, rv.creator_id, rv.total_views
    FROM rejected_videos rv
    WHERE rv.hashtags && v_hashtags
      AND rv.video_id IS NOT NULL
  LOOP
    PERFORM update_community_video_membership_rejected(p_community_id, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object('success', true, 'rejected_videos_processed', v_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_community_rejected_videos IS 
  'Backfill community memberships with rejected videos that match linked hashtags';

-- ============================================================================
-- FUNCTION: update_community_totals (ENHANCED)
-- Recalculates and updates total aggregates for a community
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_totals(p_community_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE communities
  SET 
    total_videos = (
      SELECT COUNT(DISTINCT video_id) 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    ),
    total_views = (
      -- Sum views from both edit videos and rejected videos
      SELECT COALESCE(
        (SELECT SUM(v.total_views)
         FROM community_video_memberships cvm
         JOIN videos_hot v ON v.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = TRUE),
        0
      ) + COALESCE(
        (SELECT SUM(rv.total_views)
         FROM community_video_memberships cvm
         JOIN rejected_videos rv ON rv.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = FALSE),
        0
      )
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      -- Sum likes from both edit videos and rejected videos
      SELECT COALESCE(
        (SELECT SUM(v.like_count)
         FROM community_video_memberships cvm
         JOIN videos_hot v ON v.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = TRUE),
        0
      ) + COALESCE(
        (SELECT SUM(rv.like_count)
         FROM community_video_memberships cvm
         JOIN rejected_videos rv ON rv.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = FALSE),
        0
      )
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_community_totals IS 
  'Recalculate community totals including both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: sync_community_hashtags (ENHANCED)
-- Syncs community video memberships after hashtag changes
-- Now handles BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_community_hashtags(
  p_community_id UUID,
  p_old_hashtags TEXT[],
  p_new_hashtags TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_new_hashtags TEXT[];  -- Hashtags that were added
  v_removed_hashtags TEXT[];  -- Hashtags that were removed
  v_video RECORD;
  v_video_hashtags TEXT[];
  v_matches BOOLEAN;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_rejected_added INTEGER := 0;
  v_rejected_removed INTEGER := 0;
BEGIN
  -- Get newly added hashtags (ones in new but not in old)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_new_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_old_hashtags))
  ) INTO v_new_hashtags;
  
  -- Get removed hashtags (ones in old but not in new)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_old_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_new_hashtags))
  ) INTO v_removed_hashtags;
  
  -- =======================================================================
  -- PROCESS EDIT VIDEOS (from videos_hot)
  -- =======================================================================
  
  -- Add edit videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT v.video_id, v.creator_id, v.total_views
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = ANY(v_new_hashtags)
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = v.video_id
        )
    LOOP
      PERFORM update_community_video_membership(p_community_id, v_video.video_id);
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- Remove edit videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id AND is_edit_video = TRUE
    LOOP
      -- Get current video hashtags
      v_video_hashtags := get_video_hashtags(v_video.video_id);
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id
          AND is_edit_video = TRUE;
        
        v_removed_count := v_removed_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- =======================================================================
  -- PROCESS REJECTED VIDEOS (non-edit videos)
  -- =======================================================================
  
  -- Add rejected videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT rv.video_id, rv.creator_id, rv.total_views
      FROM rejected_videos rv
      WHERE rv.hashtags && v_new_hashtags
        AND rv.video_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = rv.video_id
        )
    LOOP
      PERFORM update_community_video_membership_rejected(p_community_id, v_video.video_id);
      v_rejected_added := v_rejected_added + 1;
    END LOOP;
  END IF;
  
  -- Remove rejected videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id AND is_edit_video = FALSE
    LOOP
      -- Get rejected video hashtags
      SELECT hashtags INTO v_video_hashtags
      FROM rejected_videos
      WHERE video_id = v_video.video_id;
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id
          AND is_edit_video = FALSE;
        
        v_rejected_removed := v_rejected_removed + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Recalculate all memberships from scratch based on actual videos
  -- This ensures counts are always accurate
  PERFORM recalculate_community_hashtag_memberships(p_community_id);
  PERFORM recalculate_community_creator_memberships(p_community_id);
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'edit_videos_added', v_added_count,
    'edit_videos_removed', v_removed_count,
    'rejected_videos_added', v_rejected_added,
    'rejected_videos_removed', v_rejected_removed,
    'new_hashtags', v_new_hashtags,
    'removed_hashtags', v_removed_hashtags
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_community_hashtags IS 
  'Sync community memberships after hashtag changes, handling both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: recalculate_community_hashtag_memberships (ENHANCED)
-- Recalculates hashtag memberships from scratch based on actual videos
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_hashtag IN 
    -- Get hashtags from edit videos
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = TRUE
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
    
    UNION
    
    -- Get hashtags from rejected videos
    SELECT DISTINCT UNNEST(rv.hashtags) AS hashtag
    FROM community_video_memberships cvm
    JOIN rejected_videos rv ON rv.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = FALSE
      AND UNNEST(rv.hashtags) IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum views for this hashtag from BOTH sources
    SELECT 
      COALESCE(edit_count, 0) + COALESCE(rejected_count, 0),
      COALESCE(edit_views, 0) + COALESCE(rejected_views, 0)
    INTO v_count, v_views
    FROM (
      -- Edit videos
      SELECT 
        COUNT(*) as edit_count,
        SUM(v.total_views) as edit_views
      FROM community_video_memberships cvm
      JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = TRUE
        AND vhf.hashtag = v_hashtag
    ) edit_stats
    CROSS JOIN (
      -- Rejected videos
      SELECT 
        COUNT(*) as rejected_count,
        SUM(rv.total_views) as rejected_views
      FROM community_video_memberships cvm
      JOIN rejected_videos rv ON rv.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = FALSE
        AND v_hashtag = ANY(rv.hashtags)
    ) rejected_stats;
    
    -- Insert the recalculated membership
    IF v_count > 0 THEN
      INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, joined_at, last_updated)
      VALUES (p_community_id, v_hashtag, v_count, v_views, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_community_hashtag_memberships IS 
  'Recalculate hashtag memberships including both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: recalculate_community_creator_memberships (ENHANCED)
-- Recalculates creator memberships from scratch based on actual videos
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community (both edit and rejected)
  FOR v_creator_id IN 
    -- Get creators from edit videos
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = TRUE
    
    UNION
    
    -- Get creators from rejected videos
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN rejected_videos rv ON rv.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = FALSE
      AND rv.creator_id IS NOT NULL
  LOOP
    -- Count videos and sum views for this creator from BOTH sources
    SELECT 
      COALESCE(edit_count, 0) + COALESCE(rejected_count, 0),
      COALESCE(edit_views, 0) + COALESCE(rejected_views, 0),
      LEAST(edit_first, rejected_first),
      GREATEST(edit_last, rejected_last)
    INTO v_count, v_views, v_first_video_at, v_last_video_at
    FROM (
      -- Edit videos
      SELECT 
        COUNT(*) as edit_count,
        SUM(v.total_views) as edit_views,
        MIN(v.created_at) as edit_first,
        MAX(v.created_at) as edit_last
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = TRUE
        AND v.creator_id = v_creator_id
    ) edit_stats
    CROSS JOIN (
      -- Rejected videos
      SELECT 
        COUNT(*) as rejected_count,
        SUM(rv.total_views) as rejected_views,
        MIN(rv.video_created_at) as rejected_first,
        MAX(rv.video_created_at) as rejected_last
      FROM community_video_memberships cvm
      JOIN rejected_videos rv ON rv.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = FALSE
        AND rv.creator_id = v_creator_id
    ) rejected_stats;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, 
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_community_creator_memberships IS 
  'Recalculate creator memberships including both edit and non-edit videos';




-- ============================================================================
-- 016_sound_functions.sql
-- ============================================================================

-- Sound Helper Functions
-- Provides efficient aggregation functions for sound-related queries

-- ============================================================================
-- GET_SOUND_CREATORS
-- Returns ranked list of creators who have used a specific sound
-- Aggregates total views and video count per creator for that sound
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sound_creators(p_sound_id TEXT)
RETURNS TABLE (
  creator_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  bio TEXT,
  total_views BIGINT,
  video_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.creator_id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.verified,
    c.bio,
    SUM(v.total_views)::BIGINT AS total_views,
    COUNT(DISTINCT vsf.video_id)::INTEGER AS video_count
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  JOIN creators_hot c ON c.creator_id = v.creator_id
  WHERE vsf.sound_id = p_sound_id
  GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.bio
  ORDER BY total_views DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sound_creators IS 'Returns ranked list of creators who used a specific sound, with aggregated views and video counts';

-- ============================================================================
-- GET_SOUND_STATS
-- Returns aggregated statistics for a specific sound
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sound_stats(p_sound_id TEXT)
RETURNS TABLE (
  sound_id TEXT,
  sound_title TEXT,
  sound_author TEXT,
  views_total BIGINT,
  videos_count INTEGER,
  likes_total BIGINT,
  creators_count INTEGER,
  first_used_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.sound_id,
    s.sound_title,
    s.sound_author,
    s.views_total,
    s.videos_count,
    s.likes_total,
    COUNT(DISTINCT v.creator_id)::INTEGER AS creators_count,
    MIN(v.created_at) AS first_used_at,
    MAX(v.created_at) AS last_used_at
  FROM sounds_hot s
  LEFT JOIN video_sound_facts vsf ON vsf.sound_id = s.sound_id
  LEFT JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE s.sound_id = p_sound_id
  GROUP BY s.sound_id, s.sound_title, s.sound_author, s.views_total, s.videos_count, s.likes_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sound_stats IS 'Returns comprehensive statistics for a specific sound including creator count and date range';




-- ============================================================================
-- 027_homepage_cache.sql
-- ============================================================================

-- ============================================================================
-- HOMEPAGE CACHE TABLE
-- ============================================================================
-- High-performance cache table for homepage data
-- Stores pre-computed site stats and top 20 rankings to eliminate expensive queries
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS homepage_cache (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  
  -- Site-wide statistics
  total_videos BIGINT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_creators BIGINT DEFAULT 0,
  
  -- Top 20 videos (all-time) - deduplicated by creator
  top_videos_alltime JSONB DEFAULT '[]',
  
  -- Top 20 videos (year) - deduplicated by creator
  top_videos_year JSONB DEFAULT '[]',
  
  -- Top 20 videos (month) - deduplicated by creator
  top_videos_month JSONB DEFAULT '[]',
  
  -- Top 20 creators (all-time)
  top_creators_alltime JSONB DEFAULT '[]',
  
  -- Top 20 creators (year)
  top_creators_year JSONB DEFAULT '[]',
  
  -- Top 20 creators (month)
  top_creators_month JSONB DEFAULT '[]',
  
  -- Top 20 hashtags (all-time)
  top_hashtags_alltime JSONB DEFAULT '[]',
  top_hashtags_year JSONB DEFAULT '[]',
  top_hashtags_month JSONB DEFAULT '[]',
  
  -- Top 20 sounds (all-time)
  top_sounds_alltime JSONB DEFAULT '[]',
  top_sounds_year JSONB DEFAULT '[]',
  top_sounds_month JSONB DEFAULT '[]',
  
  -- Top 20 communities (all-time)
  top_communities_alltime JSONB DEFAULT '[]',
  top_communities_year JSONB DEFAULT '[]',
  top_communities_month JSONB DEFAULT '[]',
  
  -- Timestamps for each section
  stats_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT singleton_check CHECK (id = 'singleton')
);

-- Insert initial row
INSERT INTO homepage_cache (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE homepage_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON homepage_cache;
DROP POLICY IF EXISTS "Service role write access" ON homepage_cache;

-- Public read access
CREATE POLICY "Public read access" ON homepage_cache FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Service role write access" ON homepage_cache 
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE homepage_cache IS 'Pre-computed homepage data for instant loading';

-- ============================================================================
-- PART 2: UPDATE SITE-WIDE STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_stats()
RETURNS JSONB AS $$
DECLARE
  v_total_videos BIGINT;
  v_total_views BIGINT;
  v_total_creators BIGINT;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO v_total_videos FROM videos_hot;
  SELECT COUNT(*) INTO v_total_creators FROM creators_hot;
  SELECT COALESCE(SUM(total_views), 0) INTO v_total_views FROM videos_hot;
  
  -- Update cache
  UPDATE homepage_cache
  SET 
    total_videos = v_total_videos,
    total_views = v_total_views,
    total_creators = v_total_creators,
    stats_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = 'singleton';
  
  RETURN jsonb_build_object(
    'success', true,
    'total_videos', v_total_videos,
    'total_views', v_total_views,
    'total_creators', v_total_creators
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_stats IS 'Update site-wide statistics (videos, views, creators count)';

-- ============================================================================
-- PART 3: UPDATE TOP VIDEOS (WITH CREATOR DEDUPLICATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_videos(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_videos JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL; -- all time
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_videos_month';
      v_timestamp_column := 'videos_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_videos_year';
      v_timestamp_column := 'videos_year_updated_at';
    ELSE 
      v_column_name := 'top_videos_alltime';
      v_timestamp_column := 'videos_alltime_updated_at';
  END CASE;
  
  -- Get top 20 videos with creator deduplication
  -- Only keep highest impact_score video per creator
  WITH ranked_videos AS (
    SELECT 
      v.video_id,
      v.post_id,
      v.creator_id,
      v.url,
      v.caption,
      v.description,
      v.created_at,
      v.total_views,
      v.like_count,
      v.comment_count,
      v.share_count,
      v.save_count,
      v.duration_seconds,
      v.video_url,
      v.cover_url,
      v.thumbnail_url,
      v.impact_score,
      c.username,
      c.display_name,
      c.avatar_url,
      c.verified,
      ROW_NUMBER() OVER (
        PARTITION BY v.creator_id 
        ORDER BY v.impact_score DESC, v.total_views DESC
      ) as creator_rank,
      ROW_NUMBER() OVER (
        ORDER BY v.impact_score DESC, v.total_views DESC
      ) as global_rank
    FROM videos_hot v
    JOIN creators_hot c ON v.creator_id = c.creator_id
    WHERE 
      (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
  ),
  deduplicated_videos AS (
    SELECT 
      video_id,
      post_id,
      creator_id,
      url,
      caption,
      description,
      created_at,
      total_views,
      like_count,
      comment_count,
      share_count,
      save_count,
      duration_seconds,
      video_url,
      cover_url,
      thumbnail_url,
      impact_score,
      username,
      display_name,
      avatar_url,
      verified
    FROM ranked_videos
    WHERE creator_rank = 1  -- Only highest impact video per creator
    ORDER BY impact_score DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', video_id,
      'postId', post_id,
      'title', caption,
      'description', COALESCE(description, caption),
      'thumbnail', cover_url,
      'videoUrl', COALESCE(video_url, url),
      'creator', jsonb_build_object(
        'id', creator_id,
        'username', username,
        'avatar', COALESCE(avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(display_name, 'User') || '&background=120F23&color=fff'),
        'verified', COALESCE(verified, false)
      ),
      'views', COALESCE(total_views, 0),
      'likes', COALESCE(like_count, 0),
      'comments', COALESCE(comment_count, 0),
      'shares', COALESCE(share_count, 0),
      'saves', COALESCE(save_count, 0),
      'impact', COALESCE(impact_score, 0),
      'duration', COALESCE(duration_seconds, 0),
      'createdAt', created_at,
      'hashtags', '[]'::jsonb
    )
  ) INTO v_videos
  FROM deduplicated_videos;
  
  -- Update cache using dynamic SQL
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_videos, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'videos_count', jsonb_array_length(COALESCE(v_videos, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_videos IS 'Update top 20 videos with creator deduplication (max 1 video per creator)';

-- ============================================================================
-- PART 4: UPDATE TOP CREATORS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_creators(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_creators JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL; -- all time
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_creators_month';
      v_timestamp_column := 'creators_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_creators_year';
      v_timestamp_column := 'creators_year_updated_at';
    ELSE 
      v_column_name := 'top_creators_alltime';
      v_timestamp_column := 'creators_alltime_updated_at';
  END CASE;
  
  -- Get top 20 creators
  WITH creator_stats AS (
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.avatar_url,
      c.verified,
      c.followers_count,
      COUNT(DISTINCT v.video_id) as video_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM creators_hot c
    LEFT JOIN videos_hot v ON v.creator_id = c.creator_id
      AND (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.followers_count
    HAVING COUNT(DISTINCT v.video_id) > 0
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'unique_id', creator_id,
      'username', username,
      'displayName', display_name,
      'avatarUrl', COALESCE(avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(display_name, 'User') || '&background=120F23&color=fff'),
      'verified', COALESCE(verified, false),
      'followerCount', COALESCE(followers_count, 0),
      'videoCount', video_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_creators
  FROM creator_stats;
  
  -- Update cache using dynamic SQL
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_creators, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'creators_count', jsonb_array_length(COALESCE(v_creators, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_creators IS 'Update top 20 creators by total impact score';

-- ============================================================================
-- PART 5: UPDATE TOP HASHTAGS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_hashtags(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_hashtags JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_hashtags_month';
      v_timestamp_column := 'hashtags_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_hashtags_year';
      v_timestamp_column := 'hashtags_year_updated_at';
    ELSE 
      v_column_name := 'top_hashtags_alltime';
      v_timestamp_column := 'hashtags_alltime_updated_at';
  END CASE;
  
  -- Get top 20 hashtags
  WITH hashtag_stats AS (
    SELECT 
      h.hashtag,
      COUNT(DISTINCT vhf.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM hashtags_hot h
    JOIN video_hashtag_facts vhf ON vhf.hashtag = h.hashtag
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY h.hashtag
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'hashtag', hashtag,
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_hashtags
  FROM hashtag_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_hashtags, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'hashtags_count', jsonb_array_length(COALESCE(v_hashtags, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_hashtags IS 'Update top 20 hashtags by total impact score';

-- ============================================================================
-- PART 6: UPDATE TOP SOUNDS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_sounds(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_sounds JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_sounds_month';
      v_timestamp_column := 'sounds_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_sounds_year';
      v_timestamp_column := 'sounds_year_updated_at';
    ELSE 
      v_column_name := 'top_sounds_alltime';
      v_timestamp_column := 'sounds_alltime_updated_at';
  END CASE;
  
  -- Get top 20 sounds
  WITH sound_stats AS (
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.cover_url,
      COUNT(DISTINCT vsf.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM sounds_hot s
    JOIN video_sound_facts vsf ON vsf.sound_id = s.sound_id
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY s.sound_id, s.sound_title, s.sound_author, s.cover_url
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'soundId', sound_id,
      'title', sound_title,
      'author', sound_author,
      'coverUrl', cover_url,
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_sounds
  FROM sound_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_sounds, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'sounds_count', jsonb_array_length(COALESCE(v_sounds, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_sounds IS 'Update top 20 sounds by total impact score';

-- ============================================================================
-- PART 7: UPDATE TOP COMMUNITIES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_communities(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_communities JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_communities_month';
      v_timestamp_column := 'communities_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_communities_year';
      v_timestamp_column := 'communities_year_updated_at';
    ELSE 
      v_column_name := 'top_communities_alltime';
      v_timestamp_column := 'communities_alltime_updated_at';
  END CASE;
  
  -- Get top 20 communities
  WITH community_stats AS (
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.profile_image_url,
      c.cover_image_url,
      COALESCE(member_stats.member_count, 0) as member_count,
      COUNT(DISTINCT v.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM communities c
    LEFT JOIN video_hashtag_facts vhf ON vhf.hashtag = ANY(c.linked_hashtags)
    LEFT JOIN videos_hot v ON v.video_id = vhf.video_id
      AND (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    LEFT JOIN (
      SELECT community_id, COUNT(DISTINCT creator_id) as member_count
      FROM community_creator_memberships
      GROUP BY community_id
    ) member_stats ON member_stats.community_id = c.id
    GROUP BY c.id, c.name, c.slug, c.description, c.profile_image_url, c.cover_image_url, member_stats.member_count
    HAVING COUNT(DISTINCT v.video_id) > 0
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'slug', slug,
      'description', description,
      'imageUrl', COALESCE(profile_image_url, cover_image_url),
      'memberCount', COALESCE(member_count, 0),
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_communities
  FROM community_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_communities, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'communities_count', jsonb_array_length(COALESCE(v_communities, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_communities IS 'Update top 20 communities by total impact score';

-- ============================================================================
-- PART 8: MASTER REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_homepage_cache(p_sections TEXT[] DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMPTZ := NOW();
  v_results JSONB := '[]'::JSONB;
  v_section TEXT;
  v_result JSONB;
BEGIN
  -- If no sections specified, refresh all
  IF p_sections IS NULL THEN
    p_sections := ARRAY[
      'stats',
      'videos_all', 'videos_year', 'videos_month',
      'creators_all', 'creators_year', 'creators_month',
      'hashtags_all', 'hashtags_year', 'hashtags_month',
      'sounds_all', 'sounds_year', 'sounds_month',
      'communities_all', 'communities_year', 'communities_month'
    ];
  END IF;
  
  -- Process each section
  FOREACH v_section IN ARRAY p_sections
  LOOP
    CASE v_section
      WHEN 'stats' THEN
        v_result := update_homepage_stats();
      WHEN 'videos_all' THEN
        v_result := update_homepage_top_videos('all');
      WHEN 'videos_year' THEN
        v_result := update_homepage_top_videos('year');
      WHEN 'videos_month' THEN
        v_result := update_homepage_top_videos('month');
      WHEN 'creators_all' THEN
        v_result := update_homepage_top_creators('all');
      WHEN 'creators_year' THEN
        v_result := update_homepage_top_creators('year');
      WHEN 'creators_month' THEN
        v_result := update_homepage_top_creators('month');
      WHEN 'hashtags_all' THEN
        v_result := update_homepage_top_hashtags('all');
      WHEN 'hashtags_year' THEN
        v_result := update_homepage_top_hashtags('year');
      WHEN 'hashtags_month' THEN
        v_result := update_homepage_top_hashtags('month');
      WHEN 'sounds_all' THEN
        v_result := update_homepage_top_sounds('all');
      WHEN 'sounds_year' THEN
        v_result := update_homepage_top_sounds('year');
      WHEN 'sounds_month' THEN
        v_result := update_homepage_top_sounds('month');
      WHEN 'communities_all' THEN
        v_result := update_homepage_top_communities('all');
      WHEN 'communities_year' THEN
        v_result := update_homepage_top_communities('year');
      WHEN 'communities_month' THEN
        v_result := update_homepage_top_communities('month');
      ELSE
        v_result := jsonb_build_object('error', 'Unknown section: ' || v_section);
    END CASE;
    
    v_results := v_results || jsonb_build_object(v_section, v_result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'sections_updated', array_length(p_sections, 1),
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_cache IS 'Master function to refresh homepage cache sections';

-- ============================================================================
-- PART 9: CONVENIENCE FUNCTIONS
-- ============================================================================

-- Refresh all time-based rankings at once
CREATE OR REPLACE FUNCTION refresh_homepage_rankings()
RETURNS JSONB AS $$
BEGIN
  RETURN refresh_homepage_cache(ARRAY[
    'videos_all', 'videos_year', 'videos_month',
    'creators_all', 'creators_year', 'creators_month',
    'hashtags_all', 'hashtags_year', 'hashtags_month',
    'sounds_all', 'sounds_year', 'sounds_month',
    'communities_all', 'communities_year', 'communities_month'
  ]);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_rankings IS 'Refresh all ranking sections (videos, creators, hashtags, sounds, communities)';

-- Quick stats-only update (lightweight, can be called frequently)
CREATE OR REPLACE FUNCTION refresh_homepage_stats_only()
RETURNS JSONB AS $$
BEGIN
  RETURN refresh_homepage_cache(ARRAY['stats']);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_stats_only IS 'Update only site-wide statistics (fast operation)';

-- ============================================================================




-- ============================================================================
-- 028_creator_contacts.sql
-- ============================================================================

-- Migration: Creator Contacts Tracking
-- Date: 2024-11-03
-- Description: Track which creators users have contacted via the contact form

-- ============================================================================
-- CREATOR_CONTACTS TABLE
-- Tracks when users contact creators via the contact form
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only contact a creator once
  UNIQUE(user_id, creator_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_creator_contacts_user_id ON creator_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_creator_id ON creator_contacts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_contacted_at ON creator_contacts(contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_user_creator ON creator_contacts(user_id, creator_id);

-- RLS Policies
ALTER TABLE creator_contacts ENABLE ROW LEVEL SECURITY;

-- Users can read their own contacts
DROP POLICY IF EXISTS "Users can read own contacts" ON creator_contacts;
CREATE POLICY "Users can read own contacts" ON creator_contacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own contacts
DROP POLICY IF EXISTS "Users can insert own contacts" ON creator_contacts;
CREATE POLICY "Users can insert own contacts" ON creator_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No updates or deletes allowed (contacts are immutable)
-- Users can check if they've contacted a creator, but cannot modify/delete the record

COMMENT ON TABLE creator_contacts IS 'Tracks which creators users have contacted via the contact form';
COMMENT ON COLUMN creator_contacts.user_id IS 'The user who contacted the creator';
COMMENT ON COLUMN creator_contacts.creator_id IS 'The creator who was contacted';
COMMENT ON COLUMN creator_contacts.contacted_at IS 'When the contact form was submitted';




-- ============================================================================
-- 029_brand_contact_rate_limiting.sql
-- ============================================================================

-- ============================================================================
-- BRAND CONTACT SUBMISSIONS TABLE
-- Tracks IP-based submissions for rate limiting bot protection
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_brand_contact_ip_created 
  ON brand_contact_submissions(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_contact_created_at 
  ON brand_contact_submissions(created_at);

-- Enable RLS (though service role will access this)
ALTER TABLE brand_contact_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: No direct user access (only service role via API)
DROP POLICY IF EXISTS "Service role only" ON brand_contact_submissions;
CREATE POLICY "Service role only" ON brand_contact_submissions
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function: Delete old records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_brand_contact_submissions()
RETURNS void AS $$
BEGIN
  DELETE FROM brand_contact_submissions
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE brand_contact_submissions IS 'IP-based rate limiting for brand contact form submissions';
COMMENT ON COLUMN brand_contact_submissions.ip_address IS 'Client IP address for rate limiting';
COMMENT ON COLUMN brand_contact_submissions.created_at IS 'Timestamp when submission was made';




-- ============================================================================
-- 030_auth_rate_limiting.sql
-- ============================================================================

-- ============================================================================
-- AUTH RATE LIMITING TABLE
-- Tracks IP-based authentication attempts for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'signup', 'password-reset', 'forgot-password')),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ip_action_created 
  ON auth_rate_limits(ip_address, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_created_at 
  ON auth_rate_limits(created_at);

-- Enable RLS (though service role will access this)
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: No direct user access (only service role via API)
DROP POLICY IF EXISTS "Service role only" ON auth_rate_limits;
CREATE POLICY "Service role only" ON auth_rate_limits
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function: Delete old records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_auth_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_rate_limits
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE auth_rate_limits IS 'IP-based rate limiting for authentication attempts';
COMMENT ON COLUMN auth_rate_limits.ip_address IS 'Client IP address for rate limiting';
COMMENT ON COLUMN auth_rate_limits.action IS 'Type of authentication action: login, signup, password-reset, or forgot-password';
COMMENT ON COLUMN auth_rate_limits.success IS 'Whether the authentication attempt was successful';
COMMENT ON COLUMN auth_rate_limits.created_at IS 'Timestamp when the attempt was made';




-- ============================================================================
-- 025_fix_aggregation_error_handling.sql
-- ============================================================================

-- ============================================================================
-- FIX: Make aggregation errors more visible
-- Changes the exception handler to log errors instead of silently ignoring
-- ============================================================================

-- This is just a note - we should change the ingestion function to:
-- 1. Log aggregation errors more prominently
-- 2. Return aggregation status in the result

-- For now, let's create a helper function to verify aggregations work

CREATE OR REPLACE FUNCTION test_aggregations() RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Try to run aggregations
  SELECT update_aggregations() INTO v_result;
  
  RAISE NOTICE 'Aggregation test result: %', v_result;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aggregations function is working',
    'result', v_result
  );
EXCEPTION
  WHEN undefined_function THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'update_aggregations function does not exist',
      'hint', 'Run sql/012_aggregation.sql to create it'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- Test it immediately
SELECT test_aggregations();




-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
