-- ============================================================================
-- ADD PLATFORM COLUMN TO VIDEOS_HOT
-- Adds platform column to track whether video is from TikTok, Instagram, or YouTube
-- ============================================================================

-- Add platform column to videos_hot table
ALTER TABLE videos_hot 
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_videos_platform ON videos_hot(platform);

-- Add comment
COMMENT ON COLUMN videos_hot.platform IS 'Platform source: tiktok, instagram, youtube, or unknown';

-- Update existing videos to detect platform from URL
UPDATE videos_hot
SET platform = CASE
  WHEN video_url LIKE '%tiktok.com%' OR video_url LIKE '%vm.tiktok.com%' OR url LIKE '%tiktok.com%' OR url LIKE '%vm.tiktok.com%' THEN 'tiktok'
  WHEN video_url LIKE '%instagram.com%' OR url LIKE '%instagram.com%' THEN 'instagram'
  WHEN video_url LIKE '%youtube.com%' OR video_url LIKE '%youtu.be%' OR url LIKE '%youtube.com%' OR url LIKE '%youtu.be%' THEN 'youtube'
  ELSE 'unknown'
END
WHERE platform IS NULL;

