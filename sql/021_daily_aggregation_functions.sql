-- Daily Aggregation Functions for Time-Based Rankings
-- Functions to update daily stats on video ingestion and query time-windowed data

-- ============================================================================
-- PART 1: INGESTION-TIME UPDATE FUNCTION
-- Updates daily stats when videos are inserted or updated
-- ============================================================================

CREATE OR REPLACE FUNCTION update_daily_aggregates_for_video(
  p_video_id TEXT,
  p_old_views INTEGER DEFAULT 0,
  p_old_likes INTEGER DEFAULT 0,
  p_old_comments INTEGER DEFAULT 0,
  p_old_shares INTEGER DEFAULT 0,
  p_old_impact NUMERIC DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  v_video RECORD;
  v_video_date DATE;
  v_views_delta INTEGER;
  v_likes_delta INTEGER;
  v_comments_delta INTEGER;
  v_shares_delta INTEGER;
  v_impact_delta NUMERIC;
  v_is_new_video BOOLEAN;
  v_hashtag TEXT;
  v_sound_id TEXT;
  v_community_id UUID;
BEGIN
  -- Get video details
  SELECT 
    video_id, 
    creator_id, 
    created_at::DATE as video_date,
    views_count,
    likes_count,
    comments_count,
    shares_count,
    impact_score
  INTO v_video
  FROM videos_hot
  WHERE video_id = p_video_id;
  
  -- If video not found, exit
  IF v_video.video_id IS NULL THEN
    RAISE NOTICE 'Video % not found, skipping daily aggregation', p_video_id;
    RETURN;
  END IF;
  
  -- Determine if this is a new video or update
  v_is_new_video := (p_old_views = 0 AND p_old_likes = 0);
  
  -- Calculate deltas
  v_views_delta := v_video.views_count - p_old_views;
  v_likes_delta := v_video.likes_count - p_old_likes;
  v_comments_delta := v_video.comments_count - p_old_comments;
  v_shares_delta := v_video.shares_count - p_old_shares;
  v_impact_delta := v_video.impact_score - p_old_impact;
  
  v_video_date := v_video.video_date;
  
  -- ==========================================================================
  -- UPDATE CREATOR DAILY STATS
  -- ==========================================================================
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
  VALUES (
    v_video.creator_id, 
    v_video_date,
    CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
    v_views_delta,
    v_likes_delta,
    v_comments_delta,
    v_shares_delta,
    v_impact_delta
  )
  ON CONFLICT (creator_id, date) DO UPDATE SET
    videos_count = creator_daily_stats.videos_count + EXCLUDED.videos_count,
    views_total = creator_daily_stats.views_total + EXCLUDED.views_total,
    likes_total = creator_daily_stats.likes_total + EXCLUDED.likes_total,
    comments_total = creator_daily_stats.comments_total + EXCLUDED.comments_total,
    shares_total = creator_daily_stats.shares_total + EXCLUDED.shares_total,
    impact_score_total = creator_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
    last_updated = NOW();
  
  -- ==========================================================================
  -- UPDATE HASHTAG DAILY STATS
  -- ==========================================================================
  -- For each hashtag on this video
  FOR v_hashtag IN 
    SELECT DISTINCT hashtag 
    FROM video_hashtag_facts 
    WHERE video_id = p_video_id
  LOOP
    INSERT INTO hashtag_daily_stats (
      hashtag, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_hashtag,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (hashtag, date) DO UPDATE SET
      videos_count = hashtag_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = hashtag_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = hashtag_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = hashtag_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
  END LOOP;
  
  -- Update creators_count for hashtags (recalculate for this date)
  -- Only for new videos to avoid double counting
  IF v_is_new_video THEN
    UPDATE hashtag_daily_stats hds
    SET creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = hds.hashtag
        AND v.created_at::DATE = hds.date
    )
    WHERE date = v_video_date
      AND hashtag IN (
        SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id
      );
  END IF;
  
  -- ==========================================================================
  -- UPDATE SOUND DAILY STATS
  -- ==========================================================================
  -- Get sound_id for this video
  SELECT sound_id INTO v_sound_id
  FROM video_sound_facts
  WHERE video_id = p_video_id
  LIMIT 1;
  
  IF v_sound_id IS NOT NULL THEN
    INSERT INTO sound_daily_stats (
      sound_id, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_sound_id,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (sound_id, date) DO UPDATE SET
      videos_count = sound_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = sound_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = sound_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = sound_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
    
    -- Update creators_count for this sound (recalculate for this date)
    IF v_is_new_video THEN
      UPDATE sound_daily_stats sds
      SET creators_count = (
        SELECT COUNT(DISTINCT v.creator_id)
        FROM video_sound_facts vsf
        JOIN videos_hot v ON v.video_id = vsf.video_id
        WHERE vsf.sound_id = sds.sound_id
          AND v.created_at::DATE = sds.date
      )
      WHERE date = v_video_date
        AND sound_id = v_sound_id;
    END IF;
  END IF;
  
  -- ==========================================================================
  -- UPDATE COMMUNITY DAILY STATS
  -- ==========================================================================
  -- For each community linked to this video's hashtags
  FOR v_community_id IN 
    SELECT DISTINCT c.id
    FROM communities c
    CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
    WHERE lh IN (SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id)
  LOOP
    INSERT INTO community_daily_stats (
      community_id, 
      date, 
      videos_count, 
      creators_count,
      views_total, 
      likes_total, 
      impact_score_total
    )
    VALUES (
      v_community_id,
      v_video_date,
      CASE WHEN v_is_new_video THEN 1 ELSE 0 END,
      0, -- creators_count updated separately
      v_views_delta,
      v_likes_delta,
      v_impact_delta
    )
    ON CONFLICT (community_id, date) DO UPDATE SET
      videos_count = community_daily_stats.videos_count + EXCLUDED.videos_count,
      views_total = community_daily_stats.views_total + EXCLUDED.views_total,
      likes_total = community_daily_stats.likes_total + EXCLUDED.likes_total,
      impact_score_total = community_daily_stats.impact_score_total + EXCLUDED.impact_score_total,
      last_updated = NOW();
  END LOOP;
  
  -- Update creators_count for communities (recalculate for this date)
  IF v_is_new_video THEN
    UPDATE community_daily_stats cds
    SET creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM communities c
      CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
      JOIN video_hashtag_facts vhf ON vhf.hashtag = lh
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE c.id = cds.community_id
        AND v.created_at::DATE = cds.date
    )
    WHERE date = v_video_date
      AND community_id IN (
        SELECT c.id
        FROM communities c
        CROSS JOIN LATERAL unnest(c.linked_hashtags) AS lh
        WHERE lh IN (SELECT hashtag FROM video_hashtag_facts WHERE video_id = p_video_id)
      );
  END IF;
  
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_daily_aggregates_for_video IS 'Updates daily aggregation tables when a video is inserted or updated. Handles out-of-order ingestion by bucketing into correct date.';

-- ============================================================================
-- PART 2: QUERY FUNCTIONS FOR TIME-RANGE FILTERING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GET HASHTAGS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_hashtags_by_timerange(
  p_days INTEGER DEFAULT NULL,  -- NULL = all time, 7 = last 7 days, etc.
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'alphabetical'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  hashtag TEXT,
  hashtag_norm TEXT,
  videos_count INTEGER,
  creators_count INTEGER,
  views_total BIGINT,
  likes_total BIGINT,
  total_impact_score NUMERIC,
  trending BOOLEAN
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      h.hashtag,
      h.hashtag_norm,
      h.videos_count::INTEGER,
      h.creators_count::INTEGER,
      h.views_total::BIGINT,
      h.likes_total::BIGINT,
      h.total_impact_score,
      (h.trend_score > 100000) as trending
    FROM hashtags_hot h
    WHERE (p_search IS NULL OR h.hashtag ILIKE '%' || p_search || '%' OR h.hashtag_norm ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN h.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN h.views_total END DESC,
      CASE WHEN p_sort_by = 'videos' THEN h.videos_count END DESC,
      CASE WHEN p_sort_by = 'alphabetical' THEN h.hashtag_norm END ASC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      h.hashtag,
      h.hashtag_norm,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(MAX(ds.creators_count)::INTEGER, 0) as creators_count, -- Max to avoid double counting
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as views_total,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      FALSE as trending -- Not computed for time windows
    FROM hashtags_hot h
    LEFT JOIN hashtag_daily_stats ds ON ds.hashtag = h.hashtag
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE  -- Exclude today (partial data)
    WHERE (p_search IS NULL OR h.hashtag ILIKE '%' || p_search || '%' OR h.hashtag_norm ILIKE '%' || p_search || '%')
    GROUP BY h.hashtag, h.hashtag_norm
    HAVING SUM(ds.videos_count) > 0  -- Only show hashtags with activity in timeframe
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'alphabetical' THEN h.hashtag_norm END ASC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hashtags_by_timerange IS 'Get hashtags with metrics filtered by time range. NULL days = all time, uses hot tables. Otherwise aggregates from daily stats.';

-- ----------------------------------------------------------------------------
-- GET CREATORS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_creators_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'followers'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  creator_id TEXT,
  username TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  followers_count INTEGER,
  videos_count INTEGER,
  likes_total BIGINT,
  total_play_count BIGINT,
  total_impact_score NUMERIC
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.bio,
      c.avatar_url,
      c.verified,
      c.followers_count::INTEGER,
      c.videos_count::INTEGER,
      c.likes_total::BIGINT,
      c.total_play_count::BIGINT,
      c.total_impact_score
    FROM creators_hot c
    WHERE (p_search IS NULL OR 
           c.username ILIKE '%' || p_search || '%' OR 
           c.display_name ILIKE '%' || p_search || '%' OR 
           c.bio ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN c.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN c.total_play_count END DESC,
      CASE WHEN p_sort_by = 'followers' THEN c.followers_count END DESC,
      CASE WHEN p_sort_by = 'videos' THEN c.videos_count END DESC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      c.creator_id,
      c.username,
      c.display_name,
      c.bio,
      c.avatar_url,
      c.verified,
      c.followers_count::INTEGER, -- Current followers (not time-dependent)
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as total_play_count,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score
    FROM creators_hot c
    LEFT JOIN creator_daily_stats ds ON ds.creator_id = c.creator_id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           c.username ILIKE '%' || p_search || '%' OR 
           c.display_name ILIKE '%' || p_search || '%' OR 
           c.bio ILIKE '%' || p_search || '%')
    GROUP BY c.creator_id, c.username, c.display_name, c.bio, c.avatar_url, c.verified, c.followers_count
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'followers' THEN c.followers_count END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_creators_by_timerange IS 'Get creators with metrics filtered by time range. NULL days = all time.';

-- ----------------------------------------------------------------------------
-- GET SOUNDS BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sounds_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'likes', 'recent'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  sound_id TEXT,
  sound_title TEXT,
  sound_author TEXT,
  music_duration INTEGER,
  cover_url TEXT,
  videos_count INTEGER,
  views_total BIGINT,
  likes_total BIGINT,
  total_impact_score NUMERIC,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  -- All-time query: Use pre-computed hot tables
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.music_duration::INTEGER,
      s.cover_url,
      s.videos_count::INTEGER,
      s.views_total::BIGINT,
      s.likes_total::BIGINT,
      s.total_impact_score,
      s.last_used_at
    FROM sounds_hot s
    WHERE (p_search IS NULL OR 
           s.sound_title ILIKE '%' || p_search || '%' OR 
           s.sound_author ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN s.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN s.views_total END DESC,
      CASE WHEN p_sort_by = 'videos' THEN s.videos_count END DESC,
      CASE WHEN p_sort_by = 'likes' THEN s.likes_total END DESC,
      CASE WHEN p_sort_by = 'recent' THEN s.last_used_at END DESC
    LIMIT p_limit;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      s.sound_id,
      s.sound_title,
      s.sound_author,
      s.music_duration::INTEGER,
      s.cover_url,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as videos_count,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as views_total,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as likes_total,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      s.last_used_at -- Current last_used_at (not filtered by time)
    FROM sounds_hot s
    LEFT JOIN sound_daily_stats ds ON ds.sound_id = s.sound_id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           s.sound_title ILIKE '%' || p_search || '%' OR 
           s.sound_author ILIKE '%' || p_search || '%')
    GROUP BY s.sound_id, s.sound_title, s.sound_author, s.music_duration, s.cover_url, s.last_used_at
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'likes' THEN SUM(ds.likes_total) END DESC,
      CASE WHEN p_sort_by = 'recent' THEN s.last_used_at END DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sounds_by_timerange IS 'Get sounds with metrics filtered by time range. NULL days = all time.';

-- ----------------------------------------------------------------------------
-- GET COMMUNITIES BY TIME RANGE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_communities_by_timerange(
  p_days INTEGER DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'views',  -- 'views', 'impact', 'videos', 'creators'
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  linked_hashtags TEXT[],
  profile_image_url TEXT,
  cover_image_url TEXT,
  links JSONB,
  total_videos INTEGER,
  total_creators INTEGER,
  total_views BIGINT,
  total_likes BIGINT,
  total_impact_score NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- All-time query: Use pre-computed community totals
  IF p_days IS NULL THEN
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.linked_hashtags,
      c.profile_image_url,
      c.cover_image_url,
      c.links,
      c.total_videos::INTEGER,
      c.total_creators::INTEGER,
      c.total_views::BIGINT,
      c.total_likes::BIGINT,
      c.total_impact_score,
      c.created_at,
      c.updated_at
    FROM communities c
    WHERE (p_search IS NULL OR 
           c.name ILIKE '%' || p_search || '%' OR 
           c.description ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN c.total_impact_score END DESC,
      CASE WHEN p_sort_by = 'views' THEN c.total_views END DESC,
      CASE WHEN p_sort_by = 'videos' THEN c.total_videos END DESC,
      CASE WHEN p_sort_by = 'creators' THEN c.total_creators END DESC
    LIMIT p_limit
    OFFSET p_offset;
  
  -- Time-windowed query: Aggregate from daily stats
  ELSE
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.description,
      c.linked_hashtags,
      c.profile_image_url,
      c.cover_image_url,
      c.links,
      COALESCE(SUM(ds.videos_count)::INTEGER, 0) as total_videos,
      COALESCE(MAX(ds.creators_count)::INTEGER, 0) as total_creators,
      COALESCE(SUM(ds.views_total)::BIGINT, 0) as total_views,
      COALESCE(SUM(ds.likes_total)::BIGINT, 0) as total_likes,
      COALESCE(SUM(ds.impact_score_total), 0) as total_impact_score,
      c.created_at,
      c.updated_at
    FROM communities c
    LEFT JOIN community_daily_stats ds ON ds.community_id = c.id
      AND ds.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND ds.date < CURRENT_DATE
    WHERE (p_search IS NULL OR 
           c.name ILIKE '%' || p_search || '%' OR 
           c.description ILIKE '%' || p_search || '%')
    GROUP BY c.id, c.name, c.slug, c.description, c.linked_hashtags, 
             c.profile_image_url, c.cover_image_url, c.links, c.created_at, c.updated_at
    HAVING SUM(ds.videos_count) > 0
    ORDER BY
      CASE WHEN p_sort_by = 'impact' THEN SUM(ds.impact_score_total) END DESC,
      CASE WHEN p_sort_by = 'views' THEN SUM(ds.views_total) END DESC,
      CASE WHEN p_sort_by = 'videos' THEN SUM(ds.videos_count) END DESC,
      CASE WHEN p_sort_by = 'creators' THEN MAX(ds.creators_count) END DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_communities_by_timerange IS 'Get communities with metrics filtered by time range. NULL days = all time.';

