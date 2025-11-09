-- Backfill Script for Daily Aggregation Tables
-- One-time function to populate historical daily stats from existing videos
-- Only backfills last 365 days (sufficient for supported time ranges)

-- ============================================================================
-- BACKFILL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_daily_stats(
  p_days_back INTEGER DEFAULT 365
) RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP := NOW();
  v_cutoff_date DATE;
  v_hashtags_inserted INTEGER := 0;
  v_creators_inserted INTEGER := 0;
  v_sounds_inserted INTEGER := 0;
  v_communities_inserted INTEGER := 0;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := CURRENT_DATE - (p_days_back || ' days')::INTERVAL;
  
  RAISE NOTICE 'Starting backfill for videos created since %', v_cutoff_date;
  
  -- ==========================================================================
  -- BACKFILL CREATOR DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling creator daily stats...';
  
  INSERT INTO creator_daily_stats (
    creator_id,
    date,
    videos_count,
    views_total,
    likes_total,
    comments_total,
    shares_total,
    impact_score_total
  )
  SELECT 
    v.creator_id,
    v.created_at::DATE as date,
    COUNT(*) as videos_count,
    COALESCE(SUM(v.views_count), 0) as views_total,
    COALESCE(SUM(v.likes_count), 0) as likes_total,
    COALESCE(SUM(v.comments_count), 0) as comments_total,
    COALESCE(SUM(v.shares_count), 0) as shares_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM videos_hot v
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY v.creator_id, v.created_at::DATE
  ON CONFLICT (creator_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    comments_total = EXCLUDED.comments_total,
    shares_total = EXCLUDED.shares_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_creators_inserted = ROW_COUNT;
  RAISE NOTICE 'Creator daily stats: % rows', v_creators_inserted;
  
  -- ==========================================================================
  -- BACKFILL HASHTAG DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling hashtag daily stats...';
  
  INSERT INTO hashtag_daily_stats (
    hashtag,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    vhf.hashtag,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.views_count), 0) as views_total,
    COALESCE(SUM(v.likes_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM video_hashtag_facts vhf
  JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY vhf.hashtag, v.created_at::DATE
  ON CONFLICT (hashtag, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_hashtags_inserted = ROW_COUNT;
  RAISE NOTICE 'Hashtag daily stats: % rows', v_hashtags_inserted;
  
  -- ==========================================================================
  -- BACKFILL SOUND DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling sound daily stats...';
  
  INSERT INTO sound_daily_stats (
    sound_id,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    vsf.sound_id,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.views_count), 0) as views_total,
    COALESCE(SUM(v.likes_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY vsf.sound_id, v.created_at::DATE
  ON CONFLICT (sound_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_sounds_inserted = ROW_COUNT;
  RAISE NOTICE 'Sound daily stats: % rows', v_sounds_inserted;
  
  -- ==========================================================================
  -- BACKFILL COMMUNITY DAILY STATS
  -- ==========================================================================
  RAISE NOTICE 'Backfilling community daily stats...';
  
  INSERT INTO community_daily_stats (
    community_id,
    date,
    videos_count,
    creators_count,
    views_total,
    likes_total,
    impact_score_total
  )
  SELECT 
    c.id as community_id,
    v.created_at::DATE as date,
    COUNT(DISTINCT v.video_id) as videos_count,
    COUNT(DISTINCT v.creator_id) as creators_count,
    COALESCE(SUM(v.views_count), 0) as views_total,
    COALESCE(SUM(v.likes_count), 0) as likes_total,
    COALESCE(SUM(v.impact_score), 0) as impact_score_total
  FROM communities c
  CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
  JOIN video_hashtag_facts vhf ON vhf.hashtag = lh
  JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE v.created_at::DATE >= v_cutoff_date
  GROUP BY c.id, v.created_at::DATE
  ON CONFLICT (community_id, date) DO UPDATE SET
    videos_count = EXCLUDED.videos_count,
    creators_count = EXCLUDED.creators_count,
    views_total = EXCLUDED.views_total,
    likes_total = EXCLUDED.likes_total,
    impact_score_total = EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  GET DIAGNOSTICS v_communities_inserted = ROW_COUNT;
  RAISE NOTICE 'Community daily stats: % rows', v_communities_inserted;
  
  -- ==========================================================================
  -- RETURN SUMMARY
  -- ==========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'days_backfilled', p_days_back,
    'cutoff_date', v_cutoff_date,
    'creator_stats_rows', v_creators_inserted,
    'hashtag_stats_rows', v_hashtags_inserted,
    'sound_stats_rows', v_sounds_inserted,
    'community_stats_rows', v_communities_inserted,
    'total_rows', v_creators_inserted + v_hashtags_inserted + v_sounds_inserted + v_communities_inserted,
    'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))::INTEGER
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_daily_stats IS 'One-time backfill function to populate daily aggregation tables from existing videos. Run after creating tables: SELECT backfill_daily_stats(365);';

-- ============================================================================
-- VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_daily_stats()
RETURNS TABLE (
  table_name TEXT,
  total_rows BIGINT,
  earliest_date DATE,
  latest_date DATE,
  unique_entities BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'creator_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT creator_id)::BIGINT
  FROM creator_daily_stats
  
  UNION ALL
  
  SELECT 
    'hashtag_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT hashtag)::BIGINT
  FROM hashtag_daily_stats
  
  UNION ALL
  
  SELECT 
    'sound_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT sound_id)::BIGINT
  FROM sound_daily_stats
  
  UNION ALL
  
  SELECT 
    'community_daily_stats'::TEXT,
    COUNT(*)::BIGINT,
    MIN(date),
    MAX(date),
    COUNT(DISTINCT community_id)::BIGINT
  FROM community_daily_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_daily_stats IS 'Verification function to check daily stats tables. Run after backfill: SELECT * FROM verify_daily_stats();';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

/*
TO RUN BACKFILL:

1. Create tables:
   \i sql/020_daily_aggregation_tables.sql

2. Create functions:
   \i sql/021_daily_aggregation_functions.sql

3. Run this file:
   \i sql/022_backfill_daily_stats.sql

4. Execute backfill (365 days):
   SELECT backfill_daily_stats(365);

5. Verify results:
   SELECT * FROM verify_daily_stats();

Expected output shows:
- creator_daily_stats: thousands of rows
- hashtag_daily_stats: thousands of rows
- sound_daily_stats: thousands of rows  
- community_daily_stats: hundreds/thousands of rows

Runtime: 5-30 minutes for 100K videos

NOTE: This is a one-time operation. After running, the update_daily_aggregates_for_video()
function will keep the tables updated in real-time as videos are ingested.
*/

