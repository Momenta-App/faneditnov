-- ============================================================================
-- FIX HASHTAG STATS
-- Updates videos_count, creators_count, views_total, and total_impact_score for all hashtags
-- Run this after updating the ingestion function to fix existing data
-- ============================================================================

-- Update hashtag stats from actual video data
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
    SELECT COALESCE(SUM(v.views_count), 0)
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = h.hashtag
  ),
  likes_total = (
    SELECT COALESCE(SUM(v.likes_count), 0)
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
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
);

-- Also update hashtags with 0 videos to ensure they're set correctly
UPDATE hashtags_hot h
SET 
  videos_count = 0,
  creators_count = 0,
  views_total = 0,
  likes_total = 0,
  total_impact_score = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
);

-- Verify the fix
DO $$
DECLARE
  v_mismatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatched_count
  FROM hashtags_hot h
  WHERE EXISTS (
    SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
  )
  AND (
    h.videos_count != (SELECT COUNT(DISTINCT video_id) FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag)
    OR h.views_total != (SELECT COALESCE(SUM(v.views_count), 0) FROM video_hashtag_facts vhf JOIN videos_hot v ON v.video_id = vhf.video_id WHERE vhf.hashtag = h.hashtag)
    OR h.total_impact_score != (SELECT COALESCE(SUM(v.impact_score), 0) FROM video_hashtag_facts vhf JOIN videos_hot v ON v.video_id = vhf.video_id WHERE vhf.hashtag = h.hashtag)
  );
  
  IF v_mismatched_count > 0 THEN
    RAISE WARNING 'Found % hashtags with mismatched stats. Please review.', v_mismatched_count;
  ELSE
    RAISE NOTICE '✓ All hashtag stats are now correct!';
  END IF;
END $$;

