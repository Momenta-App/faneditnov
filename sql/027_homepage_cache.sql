-- ============================================================================
-- HOMEPAGE CACHE TABLE
-- ============================================================================
-- High-performance cache table for homepage data
-- Stores pre-computed site stats and top 20 rankings to eliminate expensive queries
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS homepage_cache (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  
  -- Site-wide statistics
  total_videos BIGINT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_creators BIGINT DEFAULT 0,
  
  -- Top 20 videos (all-time) - deduplicated by creator
  top_videos_alltime JSONB DEFAULT '[]',
  
  -- Top 20 videos (year) - deduplicated by creator
  top_videos_year JSONB DEFAULT '[]',
  
  -- Top 20 videos (month) - deduplicated by creator
  top_videos_month JSONB DEFAULT '[]',
  
  -- Top 20 creators (all-time)
  top_creators_alltime JSONB DEFAULT '[]',
  
  -- Top 20 creators (year)
  top_creators_year JSONB DEFAULT '[]',
  
  -- Top 20 creators (month)
  top_creators_month JSONB DEFAULT '[]',
  
  -- Top 20 hashtags (all-time)
  top_hashtags_alltime JSONB DEFAULT '[]',
  top_hashtags_year JSONB DEFAULT '[]',
  top_hashtags_month JSONB DEFAULT '[]',
  
  -- Top 20 sounds (all-time)
  top_sounds_alltime JSONB DEFAULT '[]',
  top_sounds_year JSONB DEFAULT '[]',
  top_sounds_month JSONB DEFAULT '[]',
  
  -- Top 20 communities (all-time)
  top_communities_alltime JSONB DEFAULT '[]',
  top_communities_year JSONB DEFAULT '[]',
  top_communities_month JSONB DEFAULT '[]',
  
  -- Timestamps for each section
  stats_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  videos_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  creators_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  hashtags_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sounds_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_alltime_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_year_updated_at TIMESTAMPTZ DEFAULT NOW(),
  communities_month_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT singleton_check CHECK (id = 'singleton')
);

-- Insert initial row
INSERT INTO homepage_cache (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE homepage_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON homepage_cache;
DROP POLICY IF EXISTS "Service role write access" ON homepage_cache;

-- Public read access
CREATE POLICY "Public read access" ON homepage_cache FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Service role write access" ON homepage_cache 
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE homepage_cache IS 'Pre-computed homepage data for instant loading';

-- ============================================================================
-- PART 2: UPDATE SITE-WIDE STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_stats()
RETURNS JSONB AS $$
DECLARE
  v_total_videos BIGINT;
  v_total_views BIGINT;
  v_total_creators BIGINT;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO v_total_videos FROM videos_hot;
  SELECT COUNT(*) INTO v_total_creators FROM creators_hot;
  SELECT COALESCE(SUM(total_views), 0) INTO v_total_views FROM videos_hot;
  
  -- Update cache
  UPDATE homepage_cache
  SET 
    total_videos = v_total_videos,
    total_views = v_total_views,
    total_creators = v_total_creators,
    stats_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = 'singleton';
  
  RETURN jsonb_build_object(
    'success', true,
    'total_videos', v_total_videos,
    'total_views', v_total_views,
    'total_creators', v_total_creators
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_stats IS 'Update site-wide statistics (videos, views, creators count)';

-- ============================================================================
-- PART 3: UPDATE TOP VIDEOS (WITH CREATOR DEDUPLICATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_videos(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_videos JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL; -- all time
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_videos_month';
      v_timestamp_column := 'videos_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_videos_year';
      v_timestamp_column := 'videos_year_updated_at';
    ELSE 
      v_column_name := 'top_videos_alltime';
      v_timestamp_column := 'videos_alltime_updated_at';
  END CASE;
  
  -- Get top 20 videos with creator deduplication
  -- Only keep highest impact_score video per creator
  WITH ranked_videos AS (
    SELECT 
      v.video_id,
      v.post_id,
      v.creator_id,
      v.url,
      v.caption,
      v.description,
      v.created_at,
      v.total_views,
      v.like_count,
      v.comment_count,
      v.share_count,
      v.save_count,
      v.duration_seconds,
      v.video_url,
      v.cover_url,
      v.thumbnail_url,
      v.impact_score,
      c.username,
      c.display_name,
      c.avatar_url,
      c.verified,
      ROW_NUMBER() OVER (
        PARTITION BY v.creator_id 
        ORDER BY v.impact_score DESC, v.total_views DESC
      ) as creator_rank,
      ROW_NUMBER() OVER (
        ORDER BY v.impact_score DESC, v.total_views DESC
      ) as global_rank
    FROM videos_hot v
    JOIN creators_hot c ON v.creator_id = c.creator_id
    WHERE 
      (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
  ),
  deduplicated_videos AS (
    SELECT 
      video_id,
      post_id,
      creator_id,
      url,
      caption,
      description,
      created_at,
      total_views,
      like_count,
      comment_count,
      share_count,
      save_count,
      duration_seconds,
      video_url,
      cover_url,
      thumbnail_url,
      impact_score,
      username,
      display_name,
      avatar_url,
      verified
    FROM ranked_videos
    WHERE creator_rank = 1  -- Only highest impact video per creator
    ORDER BY impact_score DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', video_id,
      'postId', post_id,
      'title', caption,
      'description', COALESCE(description, caption),
      'thumbnail', cover_url,
      'videoUrl', COALESCE(video_url, url),
      'creator', jsonb_build_object(
        'id', creator_id,
        'username', username,
        'avatar', COALESCE(avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(display_name, 'User') || '&background=120F23&color=fff'),
        'verified', COALESCE(verified, false)
      ),
      'views', COALESCE(total_views, 0),
      'likes', COALESCE(like_count, 0),
      'comments', COALESCE(comment_count, 0),
      'shares', COALESCE(share_count, 0),
      'saves', COALESCE(save_count, 0),
      'impact', COALESCE(impact_score, 0),
      'duration', COALESCE(duration_seconds, 0),
      'createdAt', created_at,
      'hashtags', '[]'::jsonb
    )
  ) INTO v_videos
  FROM deduplicated_videos;
  
  -- Update cache using dynamic SQL
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_videos, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'videos_count', jsonb_array_length(COALESCE(v_videos, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_videos IS 'Update top 20 videos with creator deduplication (max 1 video per creator)';

-- ============================================================================
-- PART 4: UPDATE TOP CREATORS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_creators(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_creators JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL; -- all time
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_creators_month';
      v_timestamp_column := 'creators_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_creators_year';
      v_timestamp_column := 'creators_year_updated_at';
    ELSE 
      v_column_name := 'top_creators_alltime';
      v_timestamp_column := 'creators_alltime_updated_at';
  END CASE;
  
  -- Get top 20 creators
  WITH creator_stats AS (
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.avatar_url,
      c.verified,
      c.followers_count,
      COUNT(DISTINCT v.video_id) as video_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM creators_hot c
    LEFT JOIN videos_hot v ON v.creator_id = c.creator_id
      AND (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.followers_count
    HAVING COUNT(DISTINCT v.video_id) > 0
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'unique_id', creator_id,
      'username', username,
      'displayName', display_name,
      'avatarUrl', COALESCE(avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(display_name, 'User') || '&background=120F23&color=fff'),
      'verified', COALESCE(verified, false),
      'followerCount', COALESCE(followers_count, 0),
      'videoCount', video_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_creators
  FROM creator_stats;
  
  -- Update cache using dynamic SQL
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_creators, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'creators_count', jsonb_array_length(COALESCE(v_creators, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_creators IS 'Update top 20 creators by total impact score';

-- ============================================================================
-- PART 5: UPDATE TOP HASHTAGS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_hashtags(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_hashtags JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_hashtags_month';
      v_timestamp_column := 'hashtags_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_hashtags_year';
      v_timestamp_column := 'hashtags_year_updated_at';
    ELSE 
      v_column_name := 'top_hashtags_alltime';
      v_timestamp_column := 'hashtags_alltime_updated_at';
  END CASE;
  
  -- Get top 20 hashtags
  WITH hashtag_stats AS (
    SELECT 
      h.hashtag,
      COUNT(DISTINCT vhf.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM hashtags_hot h
    JOIN video_hashtag_facts vhf ON vhf.hashtag = h.hashtag
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY h.hashtag
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'hashtag', hashtag,
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_hashtags
  FROM hashtag_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_hashtags, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'hashtags_count', jsonb_array_length(COALESCE(v_hashtags, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_hashtags IS 'Update top 20 hashtags by total impact score';

-- ============================================================================
-- PART 6: UPDATE TOP SOUNDS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_sounds(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_sounds JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_sounds_month';
      v_timestamp_column := 'sounds_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_sounds_year';
      v_timestamp_column := 'sounds_year_updated_at';
    ELSE 
      v_column_name := 'top_sounds_alltime';
      v_timestamp_column := 'sounds_alltime_updated_at';
  END CASE;
  
  -- Get top 20 sounds
  WITH sound_stats AS (
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.cover_url,
      COUNT(DISTINCT vsf.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM sounds_hot s
    JOIN video_sound_facts vsf ON vsf.sound_id = s.sound_id
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    GROUP BY s.sound_id, s.sound_title, s.sound_author, s.cover_url
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'soundId', sound_id,
      'title', sound_title,
      'author', sound_author,
      'coverUrl', cover_url,
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_sounds
  FROM sound_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_sounds, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'sounds_count', jsonb_array_length(COALESCE(v_sounds, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_sounds IS 'Update top 20 sounds by total impact score';

-- ============================================================================
-- PART 7: UPDATE TOP COMMUNITIES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_homepage_top_communities(p_time_range TEXT DEFAULT 'all')
RETURNS JSONB AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_communities JSONB;
  v_column_name TEXT;
  v_timestamp_column TEXT;
BEGIN
  -- Determine cutoff date
  CASE p_time_range
    WHEN '30d', 'month' THEN v_cutoff_date := NOW() - INTERVAL '30 days';
    WHEN '1y', 'year' THEN v_cutoff_date := NOW() - INTERVAL '1 year';
    ELSE v_cutoff_date := NULL;
  END CASE;
  
  -- Determine column names
  CASE p_time_range
    WHEN '30d', 'month' THEN 
      v_column_name := 'top_communities_month';
      v_timestamp_column := 'communities_month_updated_at';
    WHEN '1y', 'year' THEN 
      v_column_name := 'top_communities_year';
      v_timestamp_column := 'communities_year_updated_at';
    ELSE 
      v_column_name := 'top_communities_alltime';
      v_timestamp_column := 'communities_alltime_updated_at';
  END CASE;
  
  -- Get top 20 communities
  WITH community_stats AS (
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.profile_image_url,
      c.cover_image_url,
      COALESCE(member_stats.member_count, 0) as member_count,
      COUNT(DISTINCT v.video_id) as video_count,
      COUNT(DISTINCT v.creator_id) as creator_count,
      COALESCE(SUM(v.total_views), 0) as total_views,
      COALESCE(SUM(v.like_count), 0) as total_likes,
      COALESCE(SUM(v.impact_score), 0) as total_impact
    FROM communities c
    LEFT JOIN video_hashtag_facts vhf ON vhf.hashtag = ANY(c.linked_hashtags)
    LEFT JOIN videos_hot v ON v.video_id = vhf.video_id
      AND (v_cutoff_date IS NULL OR v.created_at >= v_cutoff_date)
    LEFT JOIN (
      SELECT community_id, COUNT(DISTINCT creator_id) as member_count
      FROM community_creator_memberships
      GROUP BY community_id
    ) member_stats ON member_stats.community_id = c.id
    GROUP BY c.id, c.name, c.slug, c.description, c.profile_image_url, c.cover_image_url, member_stats.member_count
    HAVING COUNT(DISTINCT v.video_id) > 0
    ORDER BY total_impact DESC, total_views DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'slug', slug,
      'description', description,
      'imageUrl', COALESCE(profile_image_url, cover_image_url),
      'memberCount', COALESCE(member_count, 0),
      'videoCount', video_count,
      'creatorCount', creator_count,
      'totalViews', total_views,
      'totalLikes', total_likes,
      'impactScore', total_impact
    )
  ) INTO v_communities
  FROM community_stats;
  
  -- Update cache
  EXECUTE format(
    'UPDATE homepage_cache SET %I = $1, %I = NOW(), updated_at = NOW() WHERE id = ''singleton''',
    v_column_name,
    v_timestamp_column
  ) USING COALESCE(v_communities, '[]'::jsonb);
  
  RETURN jsonb_build_object(
    'success', true,
    'time_range', p_time_range,
    'communities_count', jsonb_array_length(COALESCE(v_communities, '[]'::jsonb))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_homepage_top_communities IS 'Update top 20 communities by total impact score';

-- ============================================================================
-- PART 8: MASTER REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_homepage_cache(p_sections TEXT[] DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMPTZ := NOW();
  v_results JSONB := '[]'::JSONB;
  v_section TEXT;
  v_result JSONB;
BEGIN
  -- If no sections specified, refresh all
  IF p_sections IS NULL THEN
    p_sections := ARRAY[
      'stats',
      'videos_all', 'videos_year', 'videos_month',
      'creators_all', 'creators_year', 'creators_month',
      'hashtags_all', 'hashtags_year', 'hashtags_month',
      'sounds_all', 'sounds_year', 'sounds_month',
      'communities_all', 'communities_year', 'communities_month'
    ];
  END IF;
  
  -- Process each section
  FOREACH v_section IN ARRAY p_sections
  LOOP
    CASE v_section
      WHEN 'stats' THEN
        v_result := update_homepage_stats();
      WHEN 'videos_all' THEN
        v_result := update_homepage_top_videos('all');
      WHEN 'videos_year' THEN
        v_result := update_homepage_top_videos('year');
      WHEN 'videos_month' THEN
        v_result := update_homepage_top_videos('month');
      WHEN 'creators_all' THEN
        v_result := update_homepage_top_creators('all');
      WHEN 'creators_year' THEN
        v_result := update_homepage_top_creators('year');
      WHEN 'creators_month' THEN
        v_result := update_homepage_top_creators('month');
      WHEN 'hashtags_all' THEN
        v_result := update_homepage_top_hashtags('all');
      WHEN 'hashtags_year' THEN
        v_result := update_homepage_top_hashtags('year');
      WHEN 'hashtags_month' THEN
        v_result := update_homepage_top_hashtags('month');
      WHEN 'sounds_all' THEN
        v_result := update_homepage_top_sounds('all');
      WHEN 'sounds_year' THEN
        v_result := update_homepage_top_sounds('year');
      WHEN 'sounds_month' THEN
        v_result := update_homepage_top_sounds('month');
      WHEN 'communities_all' THEN
        v_result := update_homepage_top_communities('all');
      WHEN 'communities_year' THEN
        v_result := update_homepage_top_communities('year');
      WHEN 'communities_month' THEN
        v_result := update_homepage_top_communities('month');
      ELSE
        v_result := jsonb_build_object('error', 'Unknown section: ' || v_section);
    END CASE;
    
    v_results := v_results || jsonb_build_object(v_section, v_result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'sections_updated', array_length(p_sections, 1),
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_cache IS 'Master function to refresh homepage cache sections';

-- ============================================================================
-- PART 9: CONVENIENCE FUNCTIONS
-- ============================================================================

-- Refresh all time-based rankings at once
CREATE OR REPLACE FUNCTION refresh_homepage_rankings()
RETURNS JSONB AS $$
BEGIN
  RETURN refresh_homepage_cache(ARRAY[
    'videos_all', 'videos_year', 'videos_month',
    'creators_all', 'creators_year', 'creators_month',
    'hashtags_all', 'hashtags_year', 'hashtags_month',
    'sounds_all', 'sounds_year', 'sounds_month',
    'communities_all', 'communities_year', 'communities_month'
  ]);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_rankings IS 'Refresh all ranking sections (videos, creators, hashtags, sounds, communities)';

-- Quick stats-only update (lightweight, can be called frequently)
CREATE OR REPLACE FUNCTION refresh_homepage_stats_only()
RETURNS JSONB AS $$
BEGIN
  RETURN refresh_homepage_cache(ARRAY['stats']);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_homepage_stats_only IS 'Update only site-wide statistics (fast operation)';

-- ============================================================================

