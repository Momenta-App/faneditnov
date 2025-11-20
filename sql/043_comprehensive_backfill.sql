-- ============================================================================
-- COMPREHENSIVE DATA BACKFILL
-- Backfills all hashtags, creators, aggregates, campaigns, communities, and homepage cache
-- 
-- Usage:
--   Run this script in your Supabase SQL editor or via psql
-- ============================================================================

-- ============================================================================
-- PART 1: BACKFILL HASHTAGS FROM VIDEOS_COLD
-- ============================================================================

DO $$
DECLARE
  v_video RECORD;
  v_hashtag TEXT;
  v_hashtags_json JSONB;
  v_hashtags_array TEXT[];
  v_hashtag_normalized TEXT;
  v_hashtags_created INTEGER := 0;
  v_relationships_created INTEGER := 0;
  v_processed_videos INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting hashtag backfill from videos_cold...';
  
  -- Process all videos in videos_cold
  FOR v_video IN 
    SELECT 
      vc.video_id,
      vc.hashtags,
      vc.full_json,
      COALESCE(vh.views_count, 0) as views_count,
      COALESCE(vh.likes_count, 0) as likes_count
    FROM videos_cold vc
    LEFT JOIN videos_hot vh ON vc.video_id = vh.video_id
  LOOP
    v_hashtags_array := '{}';
    
    -- Extract hashtags from hashtags field (TEXT[])
    IF v_video.hashtags IS NOT NULL AND array_length(v_video.hashtags, 1) > 0 THEN
      v_hashtags_array := v_video.hashtags;
    -- Extract hashtags from full_json
    ELSIF v_video.full_json IS NOT NULL AND v_video.full_json ? 'hashtags' THEN
      v_hashtags_json := v_video.full_json->'hashtags';
      
      -- Handle array of strings
      IF jsonb_typeof(v_hashtags_json) = 'array' THEN
        FOR v_hashtag IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(v_hashtags_json)
        LOOP
          v_hashtag_normalized := LOWER(REPLACE(v_hashtag, '#', ''));
          IF v_hashtag_normalized != '' AND v_hashtag_normalized != 'null' THEN
            v_hashtags_array := array_append(v_hashtags_array, v_hashtag_normalized);
          END IF;
        END LOOP;
      -- Handle single string
      ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
        v_hashtag_normalized := LOWER(REPLACE(v_hashtags_json::TEXT, '#', ''));
        IF v_hashtag_normalized != '' AND v_hashtag_normalized != 'null' THEN
          v_hashtags_array := array_append(v_hashtags_array, v_hashtag_normalized);
        END IF;
      END IF;
    END IF;
    
    -- Process each hashtag
    FOREACH v_hashtag_normalized IN ARRAY v_hashtags_array
    LOOP
      -- Insert hashtag into hashtags_hot
      INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at, last_seen_at)
      VALUES (v_hashtag_normalized, v_hashtag_normalized, NOW(), NOW())
      ON CONFLICT (hashtag) DO UPDATE SET
        last_seen_at = NOW(),
        updated_at = NOW();
      
      IF NOT FOUND THEN
        v_hashtags_created := v_hashtags_created + 1;
      END IF;
      
      -- Insert relationship into video_hashtag_facts
      INSERT INTO video_hashtag_facts (
        video_id,
        hashtag,
        snapshot_at,
        views_at_snapshot,
        likes_at_snapshot
      )
      VALUES (
        v_video.video_id,
        v_hashtag_normalized,
        NOW(),
        v_video.views_count,
        v_video.likes_count
      )
      ON CONFLICT (video_id, hashtag) DO UPDATE SET
        snapshot_at = NOW(),
        views_at_snapshot = EXCLUDED.views_at_snapshot,
        likes_at_snapshot = EXCLUDED.likes_at_snapshot;
      
      IF NOT FOUND THEN
        v_relationships_created := v_relationships_created + 1;
      END IF;
    END LOOP;
    
    v_processed_videos := v_processed_videos + 1;
    
    IF v_processed_videos % 100 = 0 THEN
      RAISE NOTICE 'Processed % videos (% hashtags, % relationships)', 
        v_processed_videos, v_hashtags_created, v_relationships_created;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Hashtag backfill complete: % videos processed, % hashtags created, % relationships created',
    v_processed_videos, v_hashtags_created, v_relationships_created;
END $$;

-- ============================================================================
-- PART 2: BACKFILL MISSING CREATORS
-- ============================================================================

DO $$
DECLARE
  v_creator_id TEXT;
  v_creators_created INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting creator backfill...';
  
  -- Insert missing creators from videos_hot
  INSERT INTO creators_hot (creator_id, username, first_seen_at, last_seen_at, updated_at)
  SELECT DISTINCT
    v.creator_id,
    COALESCE(v.creator_id, 'unknown'),
    NOW(),
    NOW(),
    NOW()
  FROM videos_hot v
  LEFT JOIN creators_hot c ON v.creator_id = c.creator_id
  WHERE c.creator_id IS NULL
    AND v.creator_id IS NOT NULL;
  
  GET DIAGNOSTICS v_creators_created = ROW_COUNT;
  
  RAISE NOTICE 'Creator backfill complete: % creators created', v_creators_created;
END $$;

-- ============================================================================
-- PART 3: UPDATE ALL AGGREGATES
-- ============================================================================

DO $$
DECLARE
  v_result JSONB;
BEGIN
  RAISE NOTICE 'Updating aggregates...';
  
  SELECT update_aggregations() INTO v_result;
  
  RAISE NOTICE 'Aggregates updated: %', v_result;
END $$;

-- ============================================================================
-- PART 4: BACKFILL ALL CAMPAIGNS
-- ============================================================================

DO $$
DECLARE
  v_campaign RECORD;
  v_result JSONB;
  v_campaigns_backfilled INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting campaign backfill...';
  
  FOR v_campaign IN SELECT id FROM campaigns
  LOOP
    BEGIN
      SELECT backfill_campaign(v_campaign.id) INTO v_result;
      v_campaigns_backfilled := v_campaigns_backfilled + 1;
      
      IF v_campaigns_backfilled % 10 = 0 THEN
        RAISE NOTICE 'Backfilled % campaigns', v_campaigns_backfilled;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error backfilling campaign %: %', v_campaign.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Campaign backfill complete: % campaigns backfilled', v_campaigns_backfilled;
END $$;

-- ============================================================================
-- PART 5: BACKFILL ALL COMMUNITIES
-- ============================================================================

DO $$
DECLARE
  v_community RECORD;
  v_result JSONB;
  v_communities_backfilled INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting community backfill...';
  
  FOR v_community IN SELECT id FROM communities
  LOOP
    BEGIN
      SELECT backfill_community(v_community.id) INTO v_result;
      v_communities_backfilled := v_communities_backfilled + 1;
      
      IF v_communities_backfilled % 10 = 0 THEN
        RAISE NOTICE 'Backfilled % communities', v_communities_backfilled;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error backfilling community %: %', v_community.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Community backfill complete: % communities backfilled', v_communities_backfilled;
END $$;

-- ============================================================================
-- PART 6: REFRESH HOMEPAGE CACHE
-- ============================================================================

DO $$
DECLARE
  v_result JSONB;
BEGIN
  RAISE NOTICE 'Refreshing homepage cache...';
  
  SELECT refresh_homepage_cache() INTO v_result;
  
  RAISE NOTICE 'Homepage cache refreshed: %', v_result;
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Comprehensive backfill complete!';
END $$;

