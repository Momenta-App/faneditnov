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

