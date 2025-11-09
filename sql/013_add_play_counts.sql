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

COMMENT ON COLUMN creators_hot.total_play_count IS 'Sum of all videos views_count for this creator';

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
  SELECT COALESCE(SUM(views_count), 0)
  FROM videos_hot v
  WHERE v.creator_id = c.creator_id
);

