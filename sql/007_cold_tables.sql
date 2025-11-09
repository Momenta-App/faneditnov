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

