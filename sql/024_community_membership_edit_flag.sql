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

