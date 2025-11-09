-- Aggregation Function to Update Counts
-- This function updates aggregate counts for creators, sounds, and hashtags

-- ============================================================================
-- UPDATE_AGGREGATIONS
-- Main function to update all aggregation tables after data ingestion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregations() RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_result JSONB := '{}'::JSONB;
  v_creators_updated INTEGER := 0;
  v_sounds_updated INTEGER := 0;
  v_hashtags_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation update...';

  -- =======================================================================
  -- UPDATE CREATOR COUNTS
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
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
  );
  
  GET DIAGNOSTICS v_creators_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % creators', v_creators_updated;

  -- =======================================================================
  -- UPDATE SOUND COUNTS
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
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
  );
  
  GET DIAGNOSTICS v_sounds_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % sounds', v_sounds_updated;

  -- =======================================================================
  -- UPDATE HASHTAG COUNTS
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
    trend_score = (
      CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 3600 THEN views_total * 10.0 -- Recent activity
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 86400 THEN views_total * 5.0 -- Last 24h
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 604800 THEN views_total * 2.0 -- Last week
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

COMMENT ON FUNCTION update_aggregations IS 'Update aggregate counts for creators, sounds, and hashtags';

-- ============================================================================
-- AUTOMATIC AGGREGATION TRIGGER
-- ============================================================================
-- Optionally, you can create triggers to automatically update counts
-- when data changes. This is commented out for now to avoid performance issues.

/*
CREATE OR REPLACE FUNCTION trigger_update_aggregations()
RETURNS TRIGGER AS $$
BEGIN
  -- Call update_aggregations() asynchronously or on a schedule
  -- For now, just log the change
  RAISE NOTICE 'Data changed, aggregation update recommended';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_video_insert
  AFTER INSERT ON videos_hot
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_aggregations();
*/

-- ============================================================================
-- QUICK AGGREGATION UPDATE (SELECTED TABLES ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregation_quick(
  p_table_name TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
BEGIN
  -- If no table specified, update all
  IF p_table_name IS NULL OR p_table_name = 'creators' THEN
    UPDATE creators_hot c
    SET 
      videos_count = (SELECT COUNT(*) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      likes_total = (SELECT COALESCE(SUM(likes_count), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      total_play_count = (SELECT COALESCE(SUM(views_count), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),
      updated_at = NOW();
  END IF;

  IF p_table_name IS NULL OR p_table_name = 'sounds' THEN
    UPDATE sounds_hot s
    SET 
      videos_count = (SELECT COUNT(DISTINCT video_id) FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id),
      views_total = (SELECT COALESCE(SUM(v.views_count), 0) FROM video_sound_facts vsf JOIN videos_hot v ON v.video_id = vsf.video_id WHERE vsf.sound_id = s.sound_id),
      updated_at = NOW();
  END IF;

  IF p_table_name IS NULL OR p_table_name = 'hashtags' THEN
    UPDATE hashtags_hot h
    SET 
      videos_count = (SELECT COUNT(DISTINCT video_id) FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag),
      views_total = (SELECT COALESCE(SUM(v.views_count), 0) FROM video_hashtag_facts vhf JOIN videos_hot v ON v.video_id = vhf.video_id WHERE vhf.hashtag = h.hashtag),
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aggregation updated'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_aggregation_quick IS 'Quick update of specific aggregation tables';

