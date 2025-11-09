-- Migration: Community Rejected Video Functions
-- This migration adds functions to handle non-edit videos (rejected videos)
-- in community memberships

-- ============================================================================
-- HELPER FUNCTION: check_rejected_video_community_match
-- Returns TRUE if a rejected video's hashtags intersect with a community's linked_hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rejected_video_community_match(
  p_video_id TEXT,
  p_community_hashtags TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM rejected_videos rv
    WHERE rv.video_id = p_video_id
      AND rv.hashtags && p_community_hashtags
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_rejected_video_community_match IS 
  'Check if a rejected video matches a community based on hashtags';

-- ============================================================================
-- FUNCTION: update_community_video_membership_rejected
-- Adds or removes a rejected video from a community based on hashtag match
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_video_membership_rejected(
  p_community_id UUID,
  p_video_id TEXT
) RETURNS void AS $$
DECLARE
  v_matches BOOLEAN;
  v_views_count BIGINT;
  v_creator_id TEXT;
  v_video_hashtags TEXT[];
  v_hashtag TEXT;
  v_community_hashtags TEXT[];
BEGIN
  -- Get video details from rejected_videos
  SELECT views_count, creator_id, hashtags 
  INTO v_views_count, v_creator_id, v_video_hashtags
  FROM rejected_videos
  WHERE video_id = p_video_id;
  
  -- If video not found, exit
  IF v_creator_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get community hashtags
  SELECT linked_hashtags INTO v_community_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  -- Check if video matches community
  v_matches := v_video_hashtags && v_community_hashtags;
  
  IF v_matches THEN
    -- Add/update membership (marked as non-edit video)
    INSERT INTO community_video_memberships (community_id, video_id, is_edit_video)
    VALUES (p_community_id, p_video_id, FALSE)
    ON CONFLICT (community_id, video_id) DO UPDATE SET
      last_updated = NOW(),
      is_edit_video = FALSE;
    
    -- Update creator membership
    INSERT INTO community_creator_memberships (community_id, creator_id, total_views, video_count)
    VALUES (p_community_id, v_creator_id, COALESCE(v_views_count, 0), 1)
    ON CONFLICT (community_id, creator_id) DO UPDATE SET
      total_views = community_creator_memberships.total_views + EXCLUDED.total_views,
      video_count = community_creator_memberships.video_count + 1,
      last_video_at = NOW(),
      last_updated = NOW();
    
    -- Update hashtag memberships for each matching hashtag
    FOR v_hashtag IN 
      SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      WHERE hashtag = ANY(v_community_hashtags)
    LOOP
      INSERT INTO community_hashtag_memberships (community_id, hashtag, total_views, video_count)
      VALUES (p_community_id, v_hashtag, COALESCE(v_views_count, 0), 1)
      ON CONFLICT (community_id, hashtag) DO UPDATE SET
        total_views = community_hashtag_memberships.total_views + EXCLUDED.total_views,
        video_count = community_hashtag_memberships.video_count + 1,
        last_used_at = NOW(),
        last_updated = NOW();
    END LOOP;
  ELSE
    -- Remove membership if no hashtags match
    DELETE FROM community_video_memberships
    WHERE community_id = p_community_id 
      AND video_id = p_video_id 
      AND is_edit_video = FALSE;
    
    -- Update creator membership (decrement)
    UPDATE community_creator_memberships
    SET total_views = GREATEST(0, total_views - COALESCE(v_views_count, 0)),
        video_count = GREATEST(0, video_count - 1),
        last_updated = NOW()
    WHERE community_id = p_community_id AND creator_id = v_creator_id;
    
    -- Update hashtag memberships (decrement for all video hashtags)
    FOR v_hashtag IN SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
    LOOP
      UPDATE community_hashtag_memberships
      SET total_views = GREATEST(0, total_views - COALESCE(v_views_count, 0)),
          video_count = GREATEST(0, video_count - 1),
          last_updated = NOW()
      WHERE community_id = p_community_id AND hashtag = v_hashtag;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_community_video_membership_rejected IS 
  'Add or remove a rejected video from community memberships based on hashtag match';

-- ============================================================================
-- FUNCTION: backfill_community_rejected_videos
-- Backfills a community's memberships from existing rejected videos
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_community_rejected_videos(p_community_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hashtags TEXT[];
  v_video RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get community hashtags
  SELECT linked_hashtags INTO v_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No hashtags linked to community');
  END IF;
  
  -- Process each rejected video that matches
  FOR v_video IN 
    SELECT DISTINCT rv.video_id, rv.creator_id, rv.views_count
    FROM rejected_videos rv
    WHERE rv.hashtags && v_hashtags
      AND rv.video_id IS NOT NULL
  LOOP
    PERFORM update_community_video_membership_rejected(p_community_id, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object('success', true, 'rejected_videos_processed', v_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_community_rejected_videos IS 
  'Backfill community memberships with rejected videos that match linked hashtags';

-- ============================================================================
-- FUNCTION: update_community_totals (ENHANCED)
-- Recalculates and updates total aggregates for a community
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

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
      -- Sum views from both edit videos and rejected videos
      SELECT COALESCE(
        (SELECT SUM(v.views_count)
         FROM community_video_memberships cvm
         JOIN videos_hot v ON v.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = TRUE),
        0
      ) + COALESCE(
        (SELECT SUM(rv.views_count)
         FROM community_video_memberships cvm
         JOIN rejected_videos rv ON rv.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = FALSE),
        0
      )
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      -- Sum likes from both edit videos and rejected videos
      SELECT COALESCE(
        (SELECT SUM(v.likes_count)
         FROM community_video_memberships cvm
         JOIN videos_hot v ON v.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = TRUE),
        0
      ) + COALESCE(
        (SELECT SUM(rv.likes_count)
         FROM community_video_memberships cvm
         JOIN rejected_videos rv ON rv.video_id = cvm.video_id
         WHERE cvm.community_id = p_community_id AND cvm.is_edit_video = FALSE),
        0
      )
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_community_totals IS 
  'Recalculate community totals including both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: sync_community_hashtags (ENHANCED)
-- Syncs community video memberships after hashtag changes
-- Now handles BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_community_hashtags(
  p_community_id UUID,
  p_old_hashtags TEXT[],
  p_new_hashtags TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_new_hashtags TEXT[];  -- Hashtags that were added
  v_removed_hashtags TEXT[];  -- Hashtags that were removed
  v_video RECORD;
  v_video_hashtags TEXT[];
  v_matches BOOLEAN;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_rejected_added INTEGER := 0;
  v_rejected_removed INTEGER := 0;
BEGIN
  -- Get newly added hashtags (ones in new but not in old)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_new_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_old_hashtags))
  ) INTO v_new_hashtags;
  
  -- Get removed hashtags (ones in old but not in new)
  SELECT ARRAY(
    SELECT tag FROM UNNEST(p_old_hashtags) AS tag
    WHERE tag NOT IN (SELECT UNNEST(p_new_hashtags))
  ) INTO v_removed_hashtags;
  
  -- =======================================================================
  -- PROCESS EDIT VIDEOS (from videos_hot)
  -- =======================================================================
  
  -- Add edit videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT v.video_id, v.creator_id, v.views_count
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = ANY(v_new_hashtags)
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = v.video_id
        )
    LOOP
      PERFORM update_community_video_membership(p_community_id, v_video.video_id);
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- Remove edit videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id AND is_edit_video = TRUE
    LOOP
      -- Get current video hashtags
      v_video_hashtags := get_video_hashtags(v_video.video_id);
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id
          AND is_edit_video = TRUE;
        
        v_removed_count := v_removed_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- =======================================================================
  -- PROCESS REJECTED VIDEOS (non-edit videos)
  -- =======================================================================
  
  -- Add rejected videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT rv.video_id, rv.creator_id, rv.views_count
      FROM rejected_videos rv
      WHERE rv.hashtags && v_new_hashtags
        AND rv.video_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = rv.video_id
        )
    LOOP
      PERFORM update_community_video_membership_rejected(p_community_id, v_video.video_id);
      v_rejected_added := v_rejected_added + 1;
    END LOOP;
  END IF;
  
  -- Remove rejected videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id AND is_edit_video = FALSE
    LOOP
      -- Get rejected video hashtags
      SELECT hashtags INTO v_video_hashtags
      FROM rejected_videos
      WHERE video_id = v_video.video_id;
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id
          AND is_edit_video = FALSE;
        
        v_rejected_removed := v_rejected_removed + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Recalculate all memberships from scratch based on actual videos
  -- This ensures counts are always accurate
  PERFORM recalculate_community_hashtag_memberships(p_community_id);
  PERFORM recalculate_community_creator_memberships(p_community_id);
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'edit_videos_added', v_added_count,
    'edit_videos_removed', v_removed_count,
    'rejected_videos_added', v_rejected_added,
    'rejected_videos_removed', v_rejected_removed,
    'new_hashtags', v_new_hashtags,
    'removed_hashtags', v_removed_hashtags
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_community_hashtags IS 
  'Sync community memberships after hashtag changes, handling both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: recalculate_community_hashtag_memberships (ENHANCED)
-- Recalculates hashtag memberships from scratch based on actual videos
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_hashtag IN 
    -- Get hashtags from edit videos
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = TRUE
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
    
    UNION
    
    -- Get hashtags from rejected videos
    SELECT DISTINCT UNNEST(rv.hashtags) AS hashtag
    FROM community_video_memberships cvm
    JOIN rejected_videos rv ON rv.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = FALSE
      AND UNNEST(rv.hashtags) IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum views for this hashtag from BOTH sources
    SELECT 
      COALESCE(edit_count, 0) + COALESCE(rejected_count, 0),
      COALESCE(edit_views, 0) + COALESCE(rejected_views, 0)
    INTO v_count, v_views
    FROM (
      -- Edit videos
      SELECT 
        COUNT(*) as edit_count,
        SUM(v.views_count) as edit_views
      FROM community_video_memberships cvm
      JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = TRUE
        AND vhf.hashtag = v_hashtag
    ) edit_stats
    CROSS JOIN (
      -- Rejected videos
      SELECT 
        COUNT(*) as rejected_count,
        SUM(rv.views_count) as rejected_views
      FROM community_video_memberships cvm
      JOIN rejected_videos rv ON rv.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = FALSE
        AND v_hashtag = ANY(rv.hashtags)
    ) rejected_stats;
    
    -- Insert the recalculated membership
    IF v_count > 0 THEN
      INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, joined_at, last_updated)
      VALUES (p_community_id, v_hashtag, v_count, v_views, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_community_hashtag_memberships IS 
  'Recalculate hashtag memberships including both edit and non-edit videos';

-- ============================================================================
-- FUNCTION: recalculate_community_creator_memberships (ENHANCED)
-- Recalculates creator memberships from scratch based on actual videos
-- Now includes BOTH edit and non-edit videos
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community (both edit and rejected)
  FOR v_creator_id IN 
    -- Get creators from edit videos
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = TRUE
    
    UNION
    
    -- Get creators from rejected videos
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN rejected_videos rv ON rv.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND cvm.is_edit_video = FALSE
      AND rv.creator_id IS NOT NULL
  LOOP
    -- Count videos and sum views for this creator from BOTH sources
    SELECT 
      COALESCE(edit_count, 0) + COALESCE(rejected_count, 0),
      COALESCE(edit_views, 0) + COALESCE(rejected_views, 0),
      LEAST(edit_first, rejected_first),
      GREATEST(edit_last, rejected_last)
    INTO v_count, v_views, v_first_video_at, v_last_video_at
    FROM (
      -- Edit videos
      SELECT 
        COUNT(*) as edit_count,
        SUM(v.views_count) as edit_views,
        MIN(v.created_at) as edit_first,
        MAX(v.created_at) as edit_last
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = TRUE
        AND v.creator_id = v_creator_id
    ) edit_stats
    CROSS JOIN (
      -- Rejected videos
      SELECT 
        COUNT(*) as rejected_count,
        SUM(rv.views_count) as rejected_views,
        MIN(rv.video_created_at) as rejected_first,
        MAX(rv.video_created_at) as rejected_last
      FROM community_video_memberships cvm
      JOIN rejected_videos rv ON rv.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
        AND cvm.is_edit_video = FALSE
        AND rv.creator_id = v_creator_id
    ) rejected_stats;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, 
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_community_creator_memberships IS 
  'Recalculate creator memberships including both edit and non-edit videos';

