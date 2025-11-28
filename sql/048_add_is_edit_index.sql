-- ============================================================================
-- ADD IS_EDIT COLUMN AND INDEX TO VIDEOS_HOT
-- ============================================================================
-- This migration adds the is_edit column to videos_hot table if it doesn't exist
-- and creates a partial index for performance optimization
-- ============================================================================

-- Add is_edit column to videos_hot table
ALTER TABLE public.videos_hot 
ADD COLUMN IF NOT EXISTS is_edit BOOLEAN DEFAULT FALSE;

-- Create partial index for performance (only indexes true values)
-- This is optimal for queries filtering by is_edit = true
CREATE INDEX IF NOT EXISTS idx_videos_hot_is_edit 
ON public.videos_hot(is_edit) 
WHERE is_edit = true;

COMMENT ON COLUMN public.videos_hot.is_edit IS 'True if video contains "edit" hashtag or was uploaded via bypass. Used for filtering to show only edit videos on public pages.';

