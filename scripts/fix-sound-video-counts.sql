-- Fix Sound Video Counts and Aggregates
-- This script backfills and fixes sound metrics from video_sound_facts

-- ============================================================================
-- UPDATE SOUND VIDEO COUNTS
-- Recomputes videos_count for all sounds from video_sound_facts
-- ============================================================================

UPDATE sounds_hot s
SET 
  videos_count = (
    SELECT COUNT(DISTINCT video_id) 
    FROM video_sound_facts vsf 
    WHERE vsf.sound_id = s.sound_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);

-- ============================================================================
-- UPDATE SOUND VIEWS TOTAL
-- Recomputes views_total for all sounds
-- ============================================================================

UPDATE sounds_hot s
SET 
  views_total = (
    SELECT COALESCE(SUM(v.views_count), 0)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);

-- ============================================================================
-- UPDATE SOUND LIKES TOTAL
-- Recomputes likes_total for all sounds
-- ============================================================================

UPDATE sounds_hot s
SET 
  likes_total = (
    SELECT COALESCE(SUM(v.likes_count), 0)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);

-- ============================================================================
-- UPDATE FIRST_USED_AT AND LAST_USED_AT
-- Update timestamps based on actual video usage
-- ============================================================================

UPDATE sounds_hot s
SET 
  first_used_at = (
    SELECT MIN(v.created_at)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  last_used_at = (
    SELECT MAX(v.created_at)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);

-- ============================================================================
-- VERIFICATION QUERY
-- Check the results to ensure counts are correct
-- ============================================================================

SELECT 
  s.sound_id,
  s.sound_title,
  s.videos_count as stored_count,
  COUNT(DISTINCT vsf.video_id) as actual_count,
  s.views_total as stored_views,
  COALESCE(SUM(v.views_count), 0) as actual_views,
  CASE 
    WHEN s.videos_count = COUNT(DISTINCT vsf.video_id) THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as status
FROM sounds_hot s
LEFT JOIN video_sound_facts vsf ON vsf.sound_id = s.sound_id
LEFT JOIN videos_hot v ON v.video_id = vsf.video_id
WHERE EXISTS (SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id)
GROUP BY s.sound_id, s.sound_title, s.videos_count, s.views_total
ORDER BY actual_count DESC
LIMIT 20;

