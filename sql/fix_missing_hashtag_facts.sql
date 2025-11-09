-- ============================================================================
-- FIX MISSING HASHTAG FACTS
-- Re-extract hashtags from videos_cold and populate video_hashtag_facts
-- This fixes cases where hashtags exist in raw JSON but weren't linked
-- ============================================================================

DO $$
DECLARE
  v_video RECORD;
  v_hashtag TEXT;
  v_hashtags_array JSONB;
  v_fixed_count INTEGER := 0;
  v_total_videos INTEGER := 0;
BEGIN
  RAISE NOTICE '===== FIXING MISSING HASHTAG FACTS =====';
  
  -- Loop through all videos that have cold storage data
  FOR v_video IN 
    SELECT 
      vc.video_id,
      vc.full_json,
      vh.views_count,
      vh.likes_count
    FROM videos_cold vc
    JOIN videos_hot vh ON vh.video_id = vc.video_id
  LOOP
    v_total_videos := v_total_videos + 1;
    
    -- Extract hashtags array from JSON
    v_hashtags_array := COALESCE(v_video.full_json->'hashtags', '[]'::JSONB);
    
    -- Process each hashtag
    IF jsonb_array_length(v_hashtags_array) > 0 THEN
      FOR v_hashtag IN 
        SELECT value::TEXT 
        FROM jsonb_array_elements_text(v_hashtags_array)
      LOOP
        -- Normalize hashtag (remove #, lowercase)
        v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
        
        -- Ensure hashtag exists in hashtags_hot
        INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
        VALUES (v_hashtag, v_hashtag, NOW())
        ON CONFLICT (hashtag) DO UPDATE SET
          last_seen_at = NOW(),
          updated_at = NOW();
        
        -- Insert into video_hashtag_facts (if not exists)
        INSERT INTO video_hashtag_facts (
          video_id, 
          hashtag, 
          snapshot_at, 
          views_at_snapshot, 
          likes_at_snapshot
        )
        VALUES (
          v_video.video_id,
          v_hashtag,
          NOW(),
          v_video.views_count,
          v_video.likes_count
        )
        ON CONFLICT (video_id, hashtag) DO UPDATE SET
          snapshot_at = NOW(),
          views_at_snapshot = EXCLUDED.views_at_snapshot,
          likes_at_snapshot = EXCLUDED.likes_at_snapshot;
        
        v_fixed_count := v_fixed_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Processed % videos', v_total_videos;
  RAISE NOTICE 'Created/Updated % hashtag fact entries', v_fixed_count;
  
  -- Now re-aggregate hashtag stats
  RAISE NOTICE '===== UPDATING HASHTAG AGGREGATIONS =====';
  
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
    updated_at = NOW();
  
  RAISE NOTICE 'Hashtag aggregations updated';
  RAISE NOTICE '===== FIX COMPLETE =====';
END $$;

-- Verify the fix for 'cartoons' hashtag
SELECT 
  hashtag,
  hashtag_norm,
  videos_count AS "Videos",
  views_total AS "Views",
  creators_count AS "Creators",
  total_impact_score AS "Impact Score"
FROM hashtags_hot
WHERE hashtag IN ('cartoon', 'cartoons')
ORDER BY videos_count DESC;

-- Check video_hashtag_facts for video 7417099856897953029
SELECT 
  vhf.video_id,
  vhf.hashtag,
  v.views_count,
  h.videos_count AS hashtag_video_count
FROM video_hashtag_facts vhf
JOIN videos_hot v ON v.video_id = vhf.video_id
LEFT JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
WHERE vhf.video_id = '7417099856897953029' 
   OR vhf.video_id IN (SELECT video_id FROM videos_hot WHERE post_id = '7417099856897953029')
ORDER BY vhf.hashtag;

