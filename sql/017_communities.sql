-- Migration: Communities Feature
-- This migration adds:
-- 1. communities table (main community data)
-- 2. community_video_memberships table
-- 3. community_creator_memberships table (with aggregates)
-- 4. community_hashtag_memberships table (with aggregates)
-- 5. Helper functions for matching, membership updates, and backfills

-- ============================================================================
-- COMMUNITIES TABLE
-- Main table for community entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  profile_image_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  linked_hashtags TEXT[] NOT NULL DEFAULT '{}',
  links JSONB DEFAULT '{}',
  total_views BIGINT DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  total_creators INTEGER DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Indexes for communities
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_linked_hashtags ON communities USING GIN(linked_hashtags);
CREATE INDEX IF NOT EXISTS idx_communities_total_views ON communities(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_communities_total_videos ON communities(total_videos DESC);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_communities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_communities_updated_at ON communities;
CREATE TRIGGER trigger_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_communities_updated_at();

-- RLS Policies
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON communities;
CREATE POLICY "Public read access" ON communities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated write access" ON communities;
CREATE POLICY "Authenticated write access" ON communities 
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE communities IS 'Communities are multi-hashtag collections with real-time aggregates';
COMMENT ON COLUMN communities.linked_hashtags IS 'Array of normalized hashtag names that match this community';
COMMENT ON COLUMN communities.links IS 'Social media and website links in JSONB format';

-- ============================================================================
-- COMMUNITY_VIDEO_MEMBERSHIPS
-- Tracks which videos belong to which communities
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_video_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_video UNIQUE(community_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_community_video_community ON community_video_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_video_video ON community_video_memberships(video_id);
CREATE INDEX IF NOT EXISTS idx_community_video_joined_at ON community_video_memberships(joined_at DESC);

-- ============================================================================
-- COMMUNITY_CREATOR_MEMBERSHIPS
-- Tracks which creators belong to which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_creator_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  first_video_at TIMESTAMP WITH TIME ZONE,
  last_video_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_creator UNIQUE(community_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_community_creator_community ON community_creator_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_creator ON community_creator_memberships(creator_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_total_views ON community_creator_memberships(total_views DESC);

-- ============================================================================
-- COMMUNITY_HASHTAG_MEMBERSHIPS
-- Tracks which hashtags appear in which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_hashtag_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  first_used_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_hashtag UNIQUE(community_id, hashtag)
);

CREATE INDEX IF NOT EXISTS idx_community_hashtag_community ON community_hashtag_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_hashtag ON community_hashtag_memberships(hashtag);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_total_views ON community_hashtag_memberships(total_views DESC);

-- Enable RLS
ALTER TABLE community_video_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_creator_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_hashtag_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON community_video_memberships;
DROP POLICY IF EXISTS "Public read access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Public read access" ON community_hashtag_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_video_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_hashtag_memberships;

CREATE POLICY "Public read access" ON community_video_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_creator_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_hashtag_memberships FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON community_video_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_creator_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_hashtag_memberships 
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- ============================================================================
-- FUNCTION: check_video_community_match
-- Returns TRUE if a video's hashtags intersect with a community's linked_hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION check_video_community_match(
  p_video_id TEXT,
  p_community_hashtags TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM video_hashtag_facts vhf
    WHERE vhf.video_id = p_video_id
      AND vhf.hashtag = ANY(p_community_hashtags)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: get_video_hashtags
-- Returns array of hashtags for a given video
-- ============================================================================

CREATE OR REPLACE FUNCTION get_video_hashtags(p_video_id TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT hashtag 
    FROM video_hashtag_facts 
    WHERE video_id = p_video_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_community_video_membership
-- Adds or removes a video from a community based on hashtag match
-- ============================================================================

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

-- ============================================================================
-- FUNCTION: update_community_totals
-- Recalculates and updates total aggregates for a community
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
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: backfill_community
-- Backfills a community's memberships from existing videos
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_community(p_community_id UUID)
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
  
  -- Process each existing video
  FOR v_video IN 
    SELECT DISTINCT v.video_id, v.creator_id, v.views_count
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = ANY(v_hashtags)
  LOOP
    PERFORM update_community_video_membership(p_community_id, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object('success', true, 'videos_processed', v_count);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: recalculate_community_hashtag_memberships
-- Recalculates hashtag memberships from scratch based on actual videos
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
  
  -- Recalculate based on actual videos in the community, but only for hashtags in linked_hashtags
  FOR v_hashtag IN 
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum views for this hashtag in this community
    SELECT COUNT(*), COALESCE(SUM(v.views_count), 0)
    INTO v_count, v_views
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag = v_hashtag;
    
    -- Insert the recalculated membership
    INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, joined_at, last_updated)
    VALUES (p_community_id, v_hashtag, v_count, v_views, NOW(), NOW());
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: recalculate_community_creator_memberships
-- Recalculates creator memberships from scratch based on actual videos
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
  
  -- Recalculate based on actual videos in the community
  FOR v_creator_id IN 
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
  LOOP
    -- Count videos and sum views for this creator in this community
    SELECT 
      COUNT(*), 
      COALESCE(SUM(v.views_count), 0),
      MIN(v.created_at),
      MAX(v.created_at)
    INTO v_count, v_views, v_first_video_at, v_last_video_at
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND v.creator_id = v_creator_id;
    
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

-- ============================================================================
-- FUNCTION: sync_community_hashtags
-- Syncs community video memberships after hashtag changes
-- Intelligently adds new videos and removes only videos with NO matching hashtags
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
  
  -- Add videos with new hashtags
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
  
  -- Remove videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    LOOP
      -- Get current video hashtags
      v_video_hashtags := get_video_hashtags(v_video.video_id);
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := p_new_hashtags && v_video_hashtags;
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        -- Delete video membership
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id;
        
        v_removed_count := v_removed_count + 1;
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
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'new_hashtags', v_new_hashtags,
    'removed_hashtags', v_removed_hashtags
  );
END;
$$ LANGUAGE plpgsql;

