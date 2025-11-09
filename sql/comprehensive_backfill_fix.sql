-- ============================================================================
-- COMPREHENSIVE BACKFILL FIX
-- Re-extracts and links hashtags, sounds, and other data from videos_cold
-- Fixes videos that were ingested with the old broken code
-- ============================================================================

DO $$
DECLARE
  v_video RECORD;
  v_hashtag TEXT;
  v_hashtags_array JSONB;
  v_sound_id TEXT;
  v_fixed_hashtags INTEGER := 0;
  v_fixed_sounds INTEGER := 0;
  v_total_videos INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  COMPREHENSIVE BACKFILL FIX';
  RAISE NOTICE '========================================';
  
  -- Count total videos to process
  SELECT COUNT(*) INTO v_total_videos FROM videos_cold;
  RAISE NOTICE 'Found % videos to process', v_total_videos;
  RAISE NOTICE '';
  
  -- ==========================================================================
  -- STEP 1: RE-EXTRACT AND LINK HASHTAGS
  -- ==========================================================================
  RAISE NOTICE '===== STEP 1: FIXING HASHTAG FACTS =====';
  
  FOR v_video IN 
    SELECT 
      vc.video_id,
      vc.full_json,
      vh.views_count,
      vh.likes_count,
      vh.creator_id
    FROM videos_cold vc
    JOIN videos_hot vh ON vh.video_id = vc.video_id
  LOOP
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
        INSERT INTO hashtags_hot (hashtag, hashtag_norm, first_seen_at, last_seen_at, updated_at)
        VALUES (v_hashtag, v_hashtag, NOW(), NOW(), NOW())
        ON CONFLICT (hashtag) DO UPDATE SET
          last_seen_at = NOW(),
          updated_at = NOW();
        
        -- Ensure hashtag_cold exists if table exists
        BEGIN
          INSERT INTO hashtags_cold (hashtag, raw_data, updated_at)
          VALUES (v_hashtag, v_video.full_json, NOW())
          ON CONFLICT (hashtag) DO UPDATE SET
            updated_at = NOW();
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END;
        
        -- Insert/update video_hashtag_facts
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
        
        v_fixed_hashtags := v_fixed_hashtags + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created/Updated % hashtag fact entries', v_fixed_hashtags;
  RAISE NOTICE '';
  
  -- ==========================================================================
  -- STEP 2: RE-EXTRACT AND LINK SOUNDS
  -- ==========================================================================
  RAISE NOTICE '===== STEP 2: FIXING SOUND FACTS =====';
  
  FOR v_video IN 
    SELECT 
      vc.video_id,
      vc.full_json,
      vh.views_count,
      vh.likes_count
    FROM videos_cold vc
    JOIN videos_hot vh ON vh.video_id = vc.video_id
  LOOP
    -- Extract sound_id from various possible locations in JSON
    v_sound_id := COALESCE(
      v_video.full_json->'music'->>'id',
      v_video.full_json->'music'->>'music_id',
      v_video.full_json->>'sound_id'
    );
    
    IF v_sound_id IS NOT NULL THEN
      -- Ensure sound exists in sounds_hot
      INSERT INTO sounds_hot (
        sound_id, 
        sound_title, 
        sound_author, 
        music_duration, 
        music_is_original,
        first_used_at,
        last_used_at,
        updated_at
      )
      VALUES (
        v_sound_id,
        COALESCE(
          v_video.full_json->'music'->>'title',
          v_video.full_json->'music'->>'music_title',
          'Unknown'
        ),
        COALESCE(
          v_video.full_json->'music'->>'authorname',
          v_video.full_json->'music'->>'authorName',
          v_video.full_json->'music'->>'music_author'
        ),
        COALESCE((v_video.full_json->'music'->>'duration')::INTEGER, 0),
        COALESCE((v_video.full_json->'music'->>'original')::BOOLEAN, FALSE),
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (sound_id) DO UPDATE SET
        last_used_at = NOW(),
        updated_at = NOW();
      
      -- Ensure sound_cold exists if table exists
      BEGIN
        INSERT INTO sounds_cold (sound_id, full_json, music_details, updated_at)
        VALUES (v_sound_id, v_video.full_json->'music', v_video.full_json->'music', NOW())
        ON CONFLICT (sound_id) DO UPDATE SET
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;
      
      -- Insert/update video_sound_facts
      INSERT INTO video_sound_facts (
        video_id, 
        sound_id, 
        snapshot_at, 
        views_at_snapshot, 
        likes_at_snapshot
      )
      VALUES (
        v_video.video_id,
        v_sound_id,
        NOW(),
        v_video.views_count,
        v_video.likes_count
      )
      ON CONFLICT (video_id, sound_id) DO UPDATE SET
        snapshot_at = NOW(),
        views_at_snapshot = EXCLUDED.views_at_snapshot,
        likes_at_snapshot = EXCLUDED.likes_at_snapshot;
      
      v_fixed_sounds := v_fixed_sounds + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created/Updated % sound fact entries', v_fixed_sounds;
  RAISE NOTICE '';
  
  -- ==========================================================================
  -- STEP 3: RE-AGGREGATE HASHTAG STATS
  -- ==========================================================================
  RAISE NOTICE '===== STEP 3: UPDATING HASHTAG AGGREGATIONS =====';
  
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
  RAISE NOTICE '';
  
  -- ==========================================================================
  -- STEP 4: RE-AGGREGATE SOUND STATS
  -- ==========================================================================
  RAISE NOTICE '===== STEP 4: UPDATING SOUND AGGREGATIONS =====';
  
  UPDATE sounds_hot s
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_sound_facts vsf 
      WHERE vsf.sound_id = s.sound_id
    ),
    views_total = (
      SELECT COALESCE(SUM(v.views_count), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    updated_at = NOW();
  
  RAISE NOTICE 'Sound aggregations updated';
  RAISE NOTICE '';
  
  -- ==========================================================================
  -- SUMMARY
  -- ==========================================================================
  RAISE NOTICE '========================================';
  RAISE NOTICE '  BACKFILL COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Videos processed: %', v_total_videos;
  RAISE NOTICE 'Hashtag facts created/updated: %', v_fixed_hashtags;
  RAISE NOTICE 'Sound facts created/updated: %', v_fixed_sounds;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Check cartoon hashtags
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

-- 2. Check specific video's hashtags
SELECT 
  vhf.video_id,
  vhf.hashtag,
  h.videos_count AS "Hashtag Total Videos",
  v.views_count AS "This Video Views"
FROM video_hashtag_facts vhf
JOIN videos_hot v ON v.video_id = vhf.video_id
LEFT JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
WHERE vhf.video_id = '7417099856897953029' 
   OR vhf.video_id IN (SELECT video_id FROM videos_hot WHERE post_id = '7417099856897953029')
ORDER BY vhf.hashtag;

-- 3. Check specific video's sound
SELECT 
  vsf.video_id,
  vsf.sound_id,
  s.sound_title AS "Sound Title",
  s.sound_author AS "Artist",
  s.videos_count AS "Sound Total Videos",
  s.views_total AS "Sound Total Views"
FROM video_sound_facts vsf
JOIN videos_hot v ON v.video_id = vsf.video_id
LEFT JOIN sounds_hot s ON s.sound_id = vsf.sound_id
WHERE vsf.video_id = '7417099856897953029' 
   OR vsf.video_id IN (SELECT video_id FROM videos_hot WHERE post_id = '7417099856897953029');

-- 4. Count orphaned hashtags (exist in hashtags_hot but have no video_hashtag_facts)
SELECT 
  COUNT(*) AS orphaned_hashtags
FROM hashtags_hot h
WHERE NOT EXISTS (
  SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
);

-- 5. Count orphaned sounds (exist in sounds_hot but have no video_sound_facts)
SELECT 
  COUNT(*) AS orphaned_sounds
FROM sounds_hot s
WHERE NOT EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);

