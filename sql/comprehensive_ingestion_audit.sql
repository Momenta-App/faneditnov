-- ============================================================================
-- COMPREHENSIVE INGESTION AUDIT
-- Verifies that a video uploaded through admin bypass populates ALL tables
-- ============================================================================

-- Test with a specific video that was just uploaded
-- Replace with actual video_id from your test

DO $$
DECLARE
  v_test_video_id TEXT := '7266134030888881413'; -- Change this to your test video
  v_creator_id TEXT;
  v_sound_id TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  COMPREHENSIVE INGESTION AUDIT';
  RAISE NOTICE '  Video ID: %', v_test_video_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Get related IDs
  SELECT creator_id INTO v_creator_id FROM videos_hot WHERE video_id = v_test_video_id;
  SELECT sound_id INTO v_sound_id FROM video_sound_facts WHERE video_id = v_test_video_id;
  
  -- ============================================================================
  -- 1. VIDEOS_HOT (Core video data)
  -- ============================================================================
  RAISE NOTICE '1. VIDEOS_HOT';
  IF EXISTS (SELECT 1 FROM videos_hot WHERE video_id = v_test_video_id) THEN
    RAISE NOTICE '   ✅ Video exists in videos_hot';
    RAISE NOTICE '   - Has impact_score: %', (SELECT impact_score IS NOT NULL AND impact_score > 0 FROM videos_hot WHERE video_id = v_test_video_id);
    RAISE NOTICE '   - Has views_count: %', (SELECT views_count > 0 FROM videos_hot WHERE video_id = v_test_video_id);
    RAISE NOTICE '   - Has creator_id: %', (SELECT creator_id IS NOT NULL FROM videos_hot WHERE video_id = v_test_video_id);
  ELSE
    RAISE NOTICE '   ❌ Video NOT found in videos_hot';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 2. VIDEOS_COLD (Full JSON storage)
  -- ============================================================================
  RAISE NOTICE '2. VIDEOS_COLD';
  IF EXISTS (SELECT 1 FROM videos_cold WHERE video_id = v_test_video_id) THEN
    RAISE NOTICE '   ✅ Video exists in videos_cold';
    RAISE NOTICE '   - Has full_json: %', (SELECT full_json IS NOT NULL FROM videos_cold WHERE video_id = v_test_video_id);
  ELSE
    RAISE NOTICE '   ❌ Video NOT found in videos_cold';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 3. CREATORS_HOT (Creator profile + aggregates)
  -- ============================================================================
  RAISE NOTICE '3. CREATORS_HOT';
  IF v_creator_id IS NOT NULL AND EXISTS (SELECT 1 FROM creators_hot WHERE creator_id = v_creator_id) THEN
    RAISE NOTICE '   ✅ Creator exists: %', v_creator_id;
    RAISE NOTICE '   - videos_count: %', (SELECT videos_count FROM creators_hot WHERE creator_id = v_creator_id);
    RAISE NOTICE '   - total_play_count: %', (SELECT total_play_count FROM creators_hot WHERE creator_id = v_creator_id);
    RAISE NOTICE '   - total_impact_score: %', (SELECT total_impact_score FROM creators_hot WHERE creator_id = v_creator_id);
  ELSE
    RAISE NOTICE '   ❌ Creator NOT found';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 4. CREATOR_PROFILES_COLD (Creator full JSON)
  -- ============================================================================
  RAISE NOTICE '4. CREATOR_PROFILES_COLD';
  BEGIN
    IF v_creator_id IS NOT NULL AND EXISTS (SELECT 1 FROM creator_profiles_cold WHERE creator_id = v_creator_id) THEN
      RAISE NOTICE '   ✅ Creator profile in cold storage';
    ELSE
      RAISE NOTICE '   ❌ Creator profile NOT in cold storage';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Table does not exist';
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 5. CREATORS_COLD (Additional creator cold storage)
  -- ============================================================================
  RAISE NOTICE '5. CREATORS_COLD';
  BEGIN
    IF v_creator_id IS NOT NULL AND EXISTS (SELECT 1 FROM creators_cold WHERE creator_id = v_creator_id) THEN
      RAISE NOTICE '   ✅ Creator in creators_cold';
    ELSE
      RAISE NOTICE '   ❌ Creator NOT in creators_cold';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Table does not exist';
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 6. SOUNDS_HOT (Sound/music data + aggregates)
  -- ============================================================================
  RAISE NOTICE '6. SOUNDS_HOT';
  IF v_sound_id IS NOT NULL AND EXISTS (SELECT 1 FROM sounds_hot WHERE sound_id = v_sound_id) THEN
    RAISE NOTICE '   ✅ Sound exists: %', v_sound_id;
    RAISE NOTICE '   - sound_title: %', (SELECT sound_title FROM sounds_hot WHERE sound_id = v_sound_id);
    RAISE NOTICE '   - videos_count: %', (SELECT videos_count FROM sounds_hot WHERE sound_id = v_sound_id);
    RAISE NOTICE '   - views_total: %', (SELECT views_total FROM sounds_hot WHERE sound_id = v_sound_id);
    RAISE NOTICE '   - total_impact_score: %', (SELECT total_impact_score FROM sounds_hot WHERE sound_id = v_sound_id);
  ELSIF v_sound_id IS NULL THEN
    RAISE NOTICE '   ⚠️  Video has no sound';
  ELSE
    RAISE NOTICE '   ❌ Sound NOT found';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 7. SOUNDS_COLD (Sound full JSON)
  -- ============================================================================
  RAISE NOTICE '7. SOUNDS_COLD';
  BEGIN
    IF v_sound_id IS NOT NULL AND EXISTS (SELECT 1 FROM sounds_cold WHERE sound_id = v_sound_id) THEN
      RAISE NOTICE '   ✅ Sound in cold storage';
    ELSIF v_sound_id IS NULL THEN
      RAISE NOTICE '   ⚠️  Video has no sound';
    ELSE
      RAISE NOTICE '   ❌ Sound NOT in cold storage';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Table does not exist';
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 8. VIDEO_SOUND_FACTS (Video-Sound relationship)
  -- ============================================================================
  RAISE NOTICE '8. VIDEO_SOUND_FACTS';
  IF EXISTS (SELECT 1 FROM video_sound_facts WHERE video_id = v_test_video_id) THEN
    RAISE NOTICE '   ✅ Video-sound relationship exists';
    RAISE NOTICE '   - views_at_snapshot: %', (SELECT views_at_snapshot FROM video_sound_facts WHERE video_id = v_test_video_id);
  ELSIF v_sound_id IS NULL THEN
    RAISE NOTICE '   ⚠️  Video has no sound';
  ELSE
    RAISE NOTICE '   ❌ Video-sound relationship NOT found';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 9. HASHTAGS_HOT (Hashtag data + aggregates)
  -- ============================================================================
  RAISE NOTICE '9. HASHTAGS_HOT';
  DECLARE
    v_hashtag_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_hashtag_count
    FROM video_hashtag_facts
    WHERE video_id = v_test_video_id;
    
    IF v_hashtag_count > 0 THEN
      RAISE NOTICE '   ✅ Video has % hashtags', v_hashtag_count;
      FOR v_rec IN 
        SELECT vhf.hashtag, h.videos_count, h.views_total, h.total_impact_score
        FROM video_hashtag_facts vhf
        JOIN hashtags_hot h ON h.hashtag = vhf.hashtag
        WHERE vhf.video_id = v_test_video_id
      LOOP
        RAISE NOTICE '   - #% (videos: %, views: %, impact: %)', 
          v_rec.hashtag, v_rec.videos_count, v_rec.views_total, v_rec.total_impact_score;
      END LOOP;
    ELSE
      RAISE NOTICE '   ❌ No hashtags found for video';
    END IF;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 10. HASHTAGS_COLD (Hashtag full JSON)
  -- ============================================================================
  RAISE NOTICE '10. HASHTAGS_COLD';
  BEGIN
    DECLARE
      v_cold_hashtag_count INTEGER;
    BEGIN
      SELECT COUNT(DISTINCT hc.hashtag) INTO v_cold_hashtag_count
      FROM video_hashtag_facts vhf
      JOIN hashtags_cold hc ON hc.hashtag = vhf.hashtag
      WHERE vhf.video_id = v_test_video_id;
      
      IF v_cold_hashtag_count > 0 THEN
        RAISE NOTICE '   ✅ % hashtags in cold storage', v_cold_hashtag_count;
      ELSE
        RAISE NOTICE '   ❌ No hashtags in cold storage';
      END IF;
    END;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Table does not exist';
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 11. VIDEO_HASHTAG_FACTS (Video-Hashtag relationships)
  -- ============================================================================
  RAISE NOTICE '11. VIDEO_HASHTAG_FACTS';
  DECLARE
    v_fact_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_fact_count
    FROM video_hashtag_facts
    WHERE video_id = v_test_video_id;
    
    IF v_fact_count > 0 THEN
      RAISE NOTICE '   ✅ % video-hashtag relationships', v_fact_count;
    ELSE
      RAISE NOTICE '   ❌ No video-hashtag relationships';
    END IF;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 12. VIDEO_PLAY_COUNT_HISTORY (Delta tracking)
  -- ============================================================================
  RAISE NOTICE '12. VIDEO_PLAY_COUNT_HISTORY';
  IF EXISTS (SELECT 1 FROM video_play_count_history WHERE video_id = v_test_video_id) THEN
    RAISE NOTICE '   ✅ Video in play count history';
    RAISE NOTICE '   - previous_play_count: %', (SELECT previous_play_count FROM video_play_count_history WHERE video_id = v_test_video_id);
  ELSE
    RAISE NOTICE '   ❌ Video NOT in play count history';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 13. COMMUNITIES (If video hashtags match community hashtags)
  -- ============================================================================
  RAISE NOTICE '13. COMMUNITIES';
  BEGIN
    DECLARE
      v_community_count INTEGER;
    BEGIN
      SELECT COUNT(DISTINCT c.id) INTO v_community_count
      FROM communities c
      WHERE EXISTS (
        SELECT 1 FROM video_hashtag_facts vhf
        WHERE vhf.video_id = v_test_video_id
        AND vhf.hashtag = ANY(c.linked_hashtags)
      );
      
      IF v_community_count > 0 THEN
        RAISE NOTICE '   ✅ Video linked to % communities', v_community_count;
      ELSE
        RAISE NOTICE '   ⚠️  Video not linked to any communities';
      END IF;
    END;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Communities table does not exist';
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 14. BD_INGESTIONS (Ingestion log)
  -- ============================================================================
  RAISE NOTICE '14. BD_INGESTIONS';
  BEGIN
    IF EXISTS (SELECT 1 FROM bd_ingestions ORDER BY created_at DESC LIMIT 1) THEN
      RAISE NOTICE '   ✅ Ingestion logged';
      RAISE NOTICE '   - status: %', (SELECT status FROM bd_ingestions ORDER BY created_at DESC LIMIT 1);
      RAISE NOTICE '   - processed_count: %', (SELECT processed_count FROM bd_ingestions ORDER BY created_at DESC LIMIT 1);
    ELSE
      RAISE NOTICE '   ⚠️  No ingestion logs found';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   ⚠️  Table does not exist';
  END;
  RAISE NOTICE '';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '  AUDIT COMPLETE';
  RAISE NOTICE '========================================';
END $$;

-- Summary query
SELECT 
  'SUMMARY' AS check_type,
  EXISTS(SELECT 1 FROM videos_hot WHERE video_id = '7266134030888881413') AS video_hot_exists,
  EXISTS(SELECT 1 FROM videos_cold WHERE video_id = '7266134030888881413') AS video_cold_exists,
  EXISTS(SELECT 1 FROM video_sound_facts WHERE video_id = '7266134030888881413') AS sound_fact_exists,
  (SELECT COUNT(*) FROM video_hashtag_facts WHERE video_id = '7266134030888881413') AS hashtag_facts_count,
  EXISTS(SELECT 1 FROM video_play_count_history WHERE video_id = '7266134030888881413') AS history_exists;

