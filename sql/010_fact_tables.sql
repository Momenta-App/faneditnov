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

