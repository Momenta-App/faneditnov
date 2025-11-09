-- ============================================================================
-- FIX IMPACT SCORES FOR ALL ENTITIES
-- This recalculates impact scores for videos and aggregates them for
-- creators, hashtags, and sounds
-- ============================================================================

DO $$
DECLARE
  v_videos_total INTEGER;
  v_videos_with_impact INTEGER;
  v_avg_impact NUMERIC;
  v_max_impact NUMERIC;
  v_creators_with_impact INTEGER;
  v_sounds_with_impact INTEGER;
  v_hashtags_with_impact INTEGER;
  v_top_creator RECORD;
BEGIN
  -- STEP 1: Check current state
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE impact_score > 0),
    ROUND(AVG(impact_score), 2)
  INTO v_videos_total, v_videos_with_impact, v_avg_impact
  FROM videos_hot;
  
  RAISE NOTICE '===== BEFORE IMPACT SCORE FIX =====';
  RAISE NOTICE 'Total videos: %', v_videos_total;
  RAISE NOTICE 'Videos with impact > 0: %', v_videos_with_impact;
  RAISE NOTICE 'Average impact: %', COALESCE(v_avg_impact, 0);

  -- STEP 2: Recalculate impact_score for ALL videos
  -- Formula: Impact = 100×comments + 0.1×shares + 0.001×likes + views/100k + 0.1×saves
  RAISE NOTICE '===== RECALCULATING VIDEO IMPACT SCORES =====';

  UPDATE videos_hot
  SET 
    impact_score = public.compute_impact(
      views_count,
      likes_count,
      comments_count,
      shares_count,
      collect_count
    ),
    impact_updated_at = NOW()
  WHERE TRUE;

  -- Verify video impact scores
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE impact_score > 0),
    ROUND(AVG(impact_score), 2),
    ROUND(MAX(impact_score), 2)
  INTO v_videos_total, v_videos_with_impact, v_avg_impact, v_max_impact
  FROM videos_hot;
  
  RAISE NOTICE 'Videos updated: %', v_videos_total;
  RAISE NOTICE 'Videos with impact > 0: %', v_videos_with_impact;
  RAISE NOTICE 'Average impact: %', COALESCE(v_avg_impact, 0);
  RAISE NOTICE 'Max impact: %', COALESCE(v_max_impact, 0);

  -- STEP 3: Aggregate total_impact_score for CREATORS
  RAISE NOTICE '===== UPDATING CREATOR IMPACT SCORES =====';

  UPDATE creators_hot c
  SET 
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM videos_hot v
      WHERE v.creator_id = c.creator_id
    ),
    updated_at = NOW();

  -- Verify creator impact scores
  SELECT 
    COUNT(*) FILTER (WHERE total_impact_score > 0),
    ROUND(AVG(total_impact_score), 2),
    ROUND(MAX(total_impact_score), 2)
  INTO v_creators_with_impact, v_avg_impact, v_max_impact
  FROM creators_hot;
  
  SELECT username, total_impact_score
  INTO v_top_creator
  FROM creators_hot
  ORDER BY total_impact_score DESC
  LIMIT 1;
  
  RAISE NOTICE 'Creators with impact > 0: %', v_creators_with_impact;
  RAISE NOTICE 'Average creator impact: %', COALESCE(v_avg_impact, 0);
  RAISE NOTICE 'Max creator impact: %', COALESCE(v_max_impact, 0);
  RAISE NOTICE 'Top creator: % with impact: %', v_top_creator.username, v_top_creator.total_impact_score;

  -- STEP 4: Aggregate total_impact_score for SOUNDS
  RAISE NOTICE '===== UPDATING SOUND IMPACT SCORES =====';

  UPDATE sounds_hot s
  SET 
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    updated_at = NOW();

  -- Verify sound impact scores
  SELECT 
    COUNT(*) FILTER (WHERE total_impact_score > 0),
    ROUND(AVG(total_impact_score), 2)
  INTO v_sounds_with_impact, v_avg_impact
  FROM sounds_hot;
  
  RAISE NOTICE 'Sounds with impact > 0: %', v_sounds_with_impact;
  RAISE NOTICE 'Average sound impact: %', COALESCE(v_avg_impact, 0);

  -- STEP 5: Aggregate total_impact_score for HASHTAGS
  RAISE NOTICE '===== UPDATING HASHTAG IMPACT SCORES =====';

  UPDATE hashtags_hot h
  SET 
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    updated_at = NOW();

  -- Verify hashtag impact scores
  SELECT 
    COUNT(*) FILTER (WHERE total_impact_score > 0),
    ROUND(AVG(total_impact_score), 2)
  INTO v_hashtags_with_impact, v_avg_impact
  FROM hashtags_hot;
  
  RAISE NOTICE 'Hashtags with impact > 0: %', v_hashtags_with_impact;
  RAISE NOTICE 'Average hashtag impact: %', COALESCE(v_avg_impact, 0);

  -- STEP 6: Update communities (if they exist and have impact columns)
  RAISE NOTICE '===== UPDATING COMMUNITY TOTALS (if applicable) =====';

  BEGIN
    -- Check if communities table has total_impact_score column and update
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name = 'total_impact_score'
    ) THEN
      UPDATE communities c
      SET total_impact_score = (
        SELECT COALESCE(SUM(v.impact_score), 0)
        FROM videos_hot v
        JOIN video_hashtag_facts vhf ON vhf.video_id = v.video_id
        WHERE vhf.hashtag = ANY(c.linked_hashtags)
      );
      RAISE NOTICE 'Community impact scores updated';
    ELSE
      RAISE NOTICE 'Communities table does not have total_impact_score column, skipping';
    END IF;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'Communities table does not exist, skipping';
  END;

  RAISE NOTICE '===== IMPACT SCORE FIX COMPLETE =====';
END $$;

-- Verify the specific creator from the issue
SELECT 
  creator_id,
  username,
  display_name,
  total_play_count AS "Total Views",
  videos_count AS "Videos",
  likes_total AS "Total Likes",
  total_impact_score AS "Total Impact Score"
FROM creators_hot
WHERE creator_id = '6822973263813133317';

-- Check top creators by impact score
SELECT 
  username,
  display_name,
  total_impact_score AS "Impact Score",
  total_play_count AS "Views",
  videos_count AS "Videos"
FROM creators_hot
ORDER BY total_impact_score DESC
LIMIT 10;

-- Check hashtags with 'cartoon'
SELECT 
  hashtag,
  hashtag_norm,
  videos_count AS "Videos",
  views_total AS "Views",
  creators_count AS "Creators",
  total_impact_score AS "Impact Score"
FROM hashtags_hot
WHERE hashtag ILIKE '%cartoon%'
ORDER BY total_impact_score DESC;
