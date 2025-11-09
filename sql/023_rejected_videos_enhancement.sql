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
ADD COLUMN IF NOT EXISTS views_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hashtags TEXT[],
ADD COLUMN IF NOT EXISTS sound_id TEXT,
ADD COLUMN IF NOT EXISTS impact_score NUMERIC DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rejected_videos_video_id 
  ON rejected_videos(video_id);

CREATE INDEX IF NOT EXISTS idx_rejected_videos_creator_id_enhanced 
  ON rejected_videos(creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rejected_videos_views_count 
  ON rejected_videos(views_count DESC);

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
COMMENT ON COLUMN rejected_videos.views_count IS 'View count at time of rejection';
COMMENT ON COLUMN rejected_videos.likes_count IS 'Like count at time of rejection';
COMMENT ON COLUMN rejected_videos.comments_count IS 'Comment count at time of rejection';
COMMENT ON COLUMN rejected_videos.shares_count IS 'Share count at time of rejection';
COMMENT ON COLUMN rejected_videos.video_created_at IS 'When the video was originally created on TikTok';
COMMENT ON COLUMN rejected_videos.hashtags IS 'Array of normalized hashtags from the video';
COMMENT ON COLUMN rejected_videos.sound_id IS 'Associated sound/music ID';
COMMENT ON COLUMN rejected_videos.impact_score IS 'Calculated impact score for the video';

