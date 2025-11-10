-- ============================================================================
-- FIX CREATOR STATS
-- Updates videos_count and total_impact_score for all existing creators
-- Run this after updating the ingestion function to fix existing data
-- ============================================================================

-- Update creator stats from actual video data
UPDATE creators_hot c
SET 
  videos_count = (
    SELECT COUNT(*) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  likes_total = (
    SELECT COALESCE(SUM(likes_count), 0) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  total_play_count = (
    SELECT COALESCE(SUM(views_count), 0)
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

-- Also update creators with 0 videos to ensure they're set correctly
UPDATE creators_hot c
SET 
  videos_count = 0,
  likes_total = 0,
  total_play_count = 0,
  total_impact_score = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
);

-- Verify the fix
DO $$
DECLARE
  v_mismatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatched_count
  FROM creators_hot c
  WHERE EXISTS (
    SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
  )
  AND (
    c.videos_count != (SELECT COUNT(*) FROM videos_hot v WHERE v.creator_id = c.creator_id)
    OR c.total_impact_score != (SELECT COALESCE(SUM(impact_score), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id)
  );
  
  IF v_mismatched_count > 0 THEN
    RAISE WARNING 'Found % creators with mismatched stats. Please review.', v_mismatched_count;
  ELSE
    RAISE NOTICE '✓ All creator stats are now correct!';
  END IF;
END $$;

