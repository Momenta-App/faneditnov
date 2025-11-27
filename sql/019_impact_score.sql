-- ============================================================================
-- IMPACT SCORE IMPLEMENTATION
-- ============================================================================
-- This migration adds a comment-weighted Impact Score to complement existing
-- view-based rankings across videos, creators, hashtags, communities, and sounds.
--
-- Formula: Impact = 100 × comments + 0.001 × likes + views ÷ 100000
-- ============================================================================

-- ============================================================================
-- PART 1: IMPACT SCORE COMPUTATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_impact(
  p_views INTEGER,
  p_likes INTEGER,
  p_comments INTEGER,
  p_shares INTEGER,
  p_saves INTEGER
) RETURNS NUMERIC AS $$
BEGIN
RETURN ROUND(
  100.0 * COALESCE(p_comments, 0)
  + 0.001 * COALESCE(p_likes, 0)
  + COALESCE(p_views, 0) / 100000.0
, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.compute_impact IS 'Compute Impact Score: 100×comments + 0.001×likes + views/100k';

-- ============================================================================
-- PART 2: ADD COLUMNS TO videos_hot
-- ============================================================================

ALTER TABLE public.videos_hot
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMENT ON COLUMN videos_hot.impact_score IS 'Comment-weighted impact score for ranking';
COMMENT ON COLUMN videos_hot.impact_updated_at IS 'Timestamp of last impact score update';

-- ============================================================================
-- PART 3: TRIGGER TO AUTO-UPDATE IMPACT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.videos_set_impact() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.impact_score := public.compute_impact(
    NEW.views_count,
    NEW.likes_count,
    NEW.comments_count,
    NEW.shares_count,
    NEW.collect_count
  );
  NEW.impact_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_set_impact ON public.videos_hot;

CREATE TRIGGER trg_videos_set_impact
  BEFORE INSERT OR UPDATE OF views_count, likes_count, comments_count, shares_count, collect_count
  ON public.videos_hot
  FOR EACH ROW 
  EXECUTE FUNCTION public.videos_set_impact();

-- ============================================================================
-- PART 4: INDEXES FOR IMPACT SCORE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_videos_impact_score_desc 
  ON public.videos_hot(impact_score DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_videos_creator_impact 
  ON public.videos_hot(creator_id, impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_videos_created_impact 
  ON public.videos_hot(created_at DESC, impact_score DESC);

-- ============================================================================
-- PART 5: ADD AGGREGATE COLUMNS
-- ============================================================================

-- Creators
ALTER TABLE public.creators_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creators_total_impact 
  ON public.creators_hot(total_impact_score DESC);

COMMENT ON COLUMN creators_hot.total_impact_score IS 'Sum of impact_score from all creator videos';

-- Sounds
ALTER TABLE public.sounds_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sounds_total_impact 
  ON public.sounds_hot(total_impact_score DESC);

COMMENT ON COLUMN sounds_hot.total_impact_score IS 'Sum of impact_score from all videos using this sound';

-- Hashtags
ALTER TABLE public.hashtags_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_hashtags_total_impact 
  ON public.hashtags_hot(total_impact_score DESC);

COMMENT ON COLUMN hashtags_hot.total_impact_score IS 'Sum of impact_score from all videos with this hashtag';

-- Communities
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_communities_total_impact 
  ON public.communities(total_impact_score DESC);

COMMENT ON COLUMN communities.total_impact_score IS 'Sum of impact_score from all community videos';

-- Community sub-tables
ALTER TABLE public.community_creator_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_creator_impact 
  ON public.community_creator_memberships(total_impact_score DESC);

ALTER TABLE public.community_hashtag_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_hashtag_impact 
  ON public.community_hashtag_memberships(total_impact_score DESC);

-- ============================================================================
-- PART 6: BACKFILL EXISTING VIDEOS
-- ============================================================================
-- Note: Run this AFTER the schema changes above
-- This will update all existing videos with their impact scores

DO $$
DECLARE
  v_total_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Get total count for reporting
  SELECT COUNT(*) INTO v_total_count FROM public.videos_hot;
  
  RAISE NOTICE 'Starting impact score backfill for % videos...', v_total_count;
  
  -- Update all videos
  UPDATE public.videos_hot
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
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Backfill complete: % videos updated', v_updated_count;
END $$;

-- Verify backfill
DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT 
    COUNT(*) as total_videos,
    COUNT(*) FILTER (WHERE impact_score > 0) as videos_with_impact,
    ROUND(AVG(impact_score), 2) as avg_impact,
    ROUND(MAX(impact_score), 2) as max_impact
  INTO v_result
  FROM videos_hot;
  
  RAISE NOTICE 'Backfill verification:';
  RAISE NOTICE '  Total videos: %', v_result.total_videos;
  RAISE NOTICE '  Videos with impact > 0: %', v_result.videos_with_impact;
  RAISE NOTICE '  Average impact: %', v_result.avg_impact;
  RAISE NOTICE '  Max impact: %', v_result.max_impact;
END $$;

-- ============================================================================
-- PART 7: UPDATE AGGREGATION FUNCTIONS
-- ============================================================================

-- Update the main aggregation function to include impact scores
CREATE OR REPLACE FUNCTION update_aggregations() RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_result JSONB := '{}'::JSONB;
  v_creators_updated INTEGER := 0;
  v_sounds_updated INTEGER := 0;
  v_hashtags_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation update with impact scores...';

  -- =======================================================================
  -- UPDATE CREATOR COUNTS (INCLUDING IMPACT)
  -- =======================================================================
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
  
  GET DIAGNOSTICS v_creators_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % creators', v_creators_updated;

  -- =======================================================================
  -- UPDATE SOUND COUNTS (INCLUDING IMPACT)
  -- =======================================================================
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
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
  );
  
  GET DIAGNOSTICS v_sounds_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % sounds', v_sounds_updated;

  -- =======================================================================
  -- UPDATE HASHTAG COUNTS (INCLUDING IMPACT)
  -- =======================================================================
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
    trend_score = (
      CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 3600 THEN views_total * 10.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 86400 THEN views_total * 5.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 604800 THEN views_total * 2.0
        ELSE views_total * 1.0
      END
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
  );
  
  GET DIAGNOSTICS v_hashtags_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % hashtags', v_hashtags_updated;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'creators_updated', v_creators_updated,
    'sounds_updated', v_sounds_updated,
    'hashtags_updated', v_hashtags_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 8: UPDATE COMMUNITY FUNCTIONS
-- ============================================================================

-- Update community totals to include impact
CREATE OR REPLACE FUNCTION update_community_totals(p_community_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE communities
  SET 
    total_videos = (
      SELECT COUNT(DISTINCT video_id) 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    ),
    total_views = (
      SELECT COALESCE(SUM(v.views_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- Update community creator memberships to include impact
CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_creator_id IN 
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
  LOOP
    -- Count videos and sum metrics for this creator in this community
    SELECT 
      COUNT(*), 
      COALESCE(SUM(v.views_count), 0),
      COALESCE(SUM(v.impact_score), 0),
      MIN(v.created_at),
      MAX(v.created_at)
    INTO v_count, v_views, v_impact, v_first_video_at, v_last_video_at
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND v.creator_id = v_creator_id;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, total_impact_score,
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_impact, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update community hashtag memberships to include impact
CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community, but only for hashtags in linked_hashtags
  FOR v_hashtag IN 
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum metrics for this hashtag in this community
    SELECT COUNT(*), COALESCE(SUM(v.views_count), 0), COALESCE(SUM(v.impact_score), 0)
    INTO v_count, v_views, v_impact
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag = v_hashtag;
    
    -- Insert the recalculated membership
    INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, total_impact_score, joined_at, last_updated)
    VALUES (p_community_id, v_hashtag, v_count, v_views, v_impact, NOW(), NOW());
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 9: RECONCILIATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_impact_scores(p_days_back INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP := NOW();
  v_videos_updated INTEGER;
  v_cutoff TIMESTAMP := NOW() - (p_days_back || ' days')::INTERVAL;
BEGIN
  -- Recompute impact for recently updated videos
  UPDATE videos_hot
  SET 
    impact_score = compute_impact(views_count, likes_count, comments_count, shares_count, collect_count),
    impact_updated_at = NOW()
  WHERE updated_at >= v_cutoff;
  
  GET DIAGNOSTICS v_videos_updated = ROW_COUNT;
  
  -- Refresh aggregates
  PERFORM update_aggregations();
  
  RETURN jsonb_build_object(
    'success', true,
    'videos_reconciled', v_videos_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reconcile_impact_scores IS 'Recomputes impact scores for recently updated videos and refreshes aggregates';

-- ============================================================================
-- PART 10: BACKFILL AGGREGATES
-- ============================================================================

DO $$
DECLARE
  v_result JSONB;
  v_comm RECORD;
  v_comm_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregate backfill...';
  
  -- Run the updated aggregation function
  SELECT update_aggregations() INTO v_result;
  RAISE NOTICE 'Aggregation result: %', v_result;
  
  -- Backfill all communities
  FOR v_comm IN SELECT id FROM communities LOOP
    PERFORM update_community_totals(v_comm.id);
    PERFORM recalculate_community_creator_memberships(v_comm.id);
    PERFORM recalculate_community_hashtag_memberships(v_comm.id);
    v_comm_count := v_comm_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated % communities', v_comm_count;
  RAISE NOTICE 'Aggregate backfill complete!';
END $$;

-- ============================================================================
-- PART 11: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE '=== Impact Score Implementation Verification ===';
  
  -- Creators
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM creators_hot;
  RAISE NOTICE 'Creators: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Sounds
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM sounds_hot;
  RAISE NOTICE 'Sounds: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Hashtags
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM hashtags_hot;
  RAISE NOTICE 'Hashtags: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  -- Communities
  SELECT 
    COUNT(*) as total,
    ROUND(AVG(total_impact_score), 2) as avg_impact,
    ROUND(MAX(total_impact_score), 2) as max_impact
  INTO v_result
  FROM communities;
  RAISE NOTICE 'Communities: % total, avg impact %, max impact %', v_result.total, v_result.avg_impact, v_result.max_impact;
  
  RAISE NOTICE '=== Verification Complete ===';
END $$;

