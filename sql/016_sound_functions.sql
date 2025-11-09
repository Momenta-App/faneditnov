-- Sound Helper Functions
-- Provides efficient aggregation functions for sound-related queries

-- ============================================================================
-- GET_SOUND_CREATORS
-- Returns ranked list of creators who have used a specific sound
-- Aggregates total views and video count per creator for that sound
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sound_creators(p_sound_id TEXT)
RETURNS TABLE (
  creator_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  bio TEXT,
  total_views BIGINT,
  video_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.creator_id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.verified,
    c.bio,
    SUM(v.views_count)::BIGINT AS total_views,
    COUNT(DISTINCT vsf.video_id)::INTEGER AS video_count
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  JOIN creators_hot c ON c.creator_id = v.creator_id
  WHERE vsf.sound_id = p_sound_id
  GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.bio
  ORDER BY total_views DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sound_creators IS 'Returns ranked list of creators who used a specific sound, with aggregated views and video counts';

-- ============================================================================
-- GET_SOUND_STATS
-- Returns aggregated statistics for a specific sound
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sound_stats(p_sound_id TEXT)
RETURNS TABLE (
  sound_id TEXT,
  sound_title TEXT,
  sound_author TEXT,
  views_total BIGINT,
  videos_count INTEGER,
  likes_total BIGINT,
  creators_count INTEGER,
  first_used_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.sound_id,
    s.sound_title,
    s.sound_author,
    s.views_total,
    s.videos_count,
    s.likes_total,
    COUNT(DISTINCT v.creator_id)::INTEGER AS creators_count,
    MIN(v.created_at) AS first_used_at,
    MAX(v.created_at) AS last_used_at
  FROM sounds_hot s
  LEFT JOIN video_sound_facts vsf ON vsf.sound_id = s.sound_id
  LEFT JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE s.sound_id = p_sound_id
  GROUP BY s.sound_id, s.sound_title, s.sound_author, s.views_total, s.videos_count, s.likes_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sound_stats IS 'Returns comprehensive statistics for a specific sound including creator count and date range';

