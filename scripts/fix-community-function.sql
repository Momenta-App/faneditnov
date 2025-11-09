-- Fix the update_community_video_membership function
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_community_video_membership(
  p_community_id UUID,
  p_video_id TEXT
) RETURNS void AS $$
DECLARE
  v_matches BOOLEAN;
  v_play_count INTEGER;
  v_creator_id TEXT;
  v_video_hashtags TEXT[];
  v_hashtag TEXT;
BEGIN
  -- Get video hashtags
  v_video_hashtags := get_video_hashtags(p_video_id);
  
  -- Check if video matches community
  v_matches := EXISTS (
    SELECT 1
    FROM communities c
    WHERE c.id = p_community_id
      AND c.linked_hashtags && v_video_hashtags
  );
  
  -- Get video details
  SELECT views_count, creator_id INTO v_play_count, v_creator_id
  FROM videos_hot
  WHERE video_id = p_video_id;
  
  IF v_matches THEN
    -- Add/update membership
    INSERT INTO community_video_memberships (community_id, video_id)
    VALUES (p_community_id, p_video_id)
    ON CONFLICT (community_id, video_id) DO UPDATE SET
      last_updated = NOW();
    
    -- Update creator membership
    INSERT INTO community_creator_memberships (community_id, creator_id, total_views, video_count)
    VALUES (p_community_id, v_creator_id, v_play_count, 1)
    ON CONFLICT (community_id, creator_id) DO UPDATE SET
      total_views = community_creator_memberships.total_views + EXCLUDED.total_views,
      video_count = community_creator_memberships.video_count + 1,
      last_video_at = NOW(),
      last_updated = NOW();
    
    -- Update hashtag memberships for each matching hashtag
    FOR v_hashtag IN 
      SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      WHERE hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
    LOOP
      INSERT INTO community_hashtag_memberships (community_id, hashtag, total_views, video_count)
      VALUES (p_community_id, v_hashtag, v_play_count, 1)
      ON CONFLICT (community_id, hashtag) DO UPDATE SET
        total_views = community_hashtag_memberships.total_views + EXCLUDED.total_views,
        video_count = community_hashtag_memberships.video_count + 1,
        last_used_at = NOW(),
        last_updated = NOW();
    END LOOP;
  ELSE
    -- First check if video should remain (might have other matching hashtags)
    SELECT EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = p_community_id
        AND c.linked_hashtags && v_video_hashtags
    ) INTO v_matches;
    
    -- Only remove if no hashtags match
    IF NOT v_matches THEN
      DELETE FROM community_video_memberships
      WHERE community_id = p_community_id AND video_id = p_video_id;
      
      -- Update creator membership (decrement)
      UPDATE community_creator_memberships
      SET total_views = total_views - v_play_count,
          video_count = video_count - 1,
          last_updated = NOW()
      WHERE community_id = p_community_id AND creator_id = v_creator_id;
      
      -- Update hashtag memberships (decrement for all video hashtags)
      FOR v_hashtag IN SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      LOOP
        UPDATE community_hashtag_memberships
        SET total_views = total_views - v_play_count,
            video_count = video_count - 1,
            last_updated = NOW()
        WHERE community_id = p_community_id AND hashtag = v_hashtag;
      END LOOP;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

