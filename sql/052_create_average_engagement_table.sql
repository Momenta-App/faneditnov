-- ============================================================================
-- MIGRATION: Create Average Engagement Analysis Table
-- ============================================================================
-- This migration creates a comprehensive table to analyze engagement patterns
-- from videos_hot to establish baseline metrics for detecting potentially
-- botted viewership. The table stores statistical summaries grouped by view
-- tier ranges and platform.
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE AVERAGE_ENGAGEMENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS average_engagement (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  min_views INTEGER NOT NULL,
  max_views INTEGER, -- NULL for open-ended tiers (e.g., 100M+)
  video_count INTEGER NOT NULL DEFAULT 0,
  
  -- Likes per view percentage statistics
  likes_per_view_pct_mean NUMERIC(10,6),
  likes_per_view_pct_median NUMERIC(10,6),
  likes_per_view_pct_stddev NUMERIC(10,6),
  likes_per_view_pct_p25 NUMERIC(10,6),
  likes_per_view_pct_p75 NUMERIC(10,6),
  likes_per_view_pct_p90 NUMERIC(10,6),
  likes_per_view_pct_p95 NUMERIC(10,6),
  likes_per_view_pct_p99 NUMERIC(10,6),
  likes_per_view_pct_min NUMERIC(10,6),
  likes_per_view_pct_max NUMERIC(10,6),
  likes_per_view_normal_lower NUMERIC(10,6), -- mean - 2*stddev
  likes_per_view_normal_upper NUMERIC(10,6), -- mean + 2*stddev
  
  -- Comments per view percentage statistics
  comments_per_view_pct_mean NUMERIC(10,6),
  comments_per_view_pct_median NUMERIC(10,6),
  comments_per_view_pct_stddev NUMERIC(10,6),
  comments_per_view_pct_p25 NUMERIC(10,6),
  comments_per_view_pct_p75 NUMERIC(10,6),
  comments_per_view_pct_p90 NUMERIC(10,6),
  comments_per_view_pct_p95 NUMERIC(10,6),
  comments_per_view_pct_p99 NUMERIC(10,6),
  comments_per_view_pct_min NUMERIC(10,6),
  comments_per_view_pct_max NUMERIC(10,6),
  comments_per_view_normal_lower NUMERIC(10,6), -- mean - 2*stddev
  comments_per_view_normal_upper NUMERIC(10,6), -- mean + 2*stddev
  
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent duplicate tier/platform combinations
-- Use COALESCE to handle NULL max_views (for open-ended tiers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_average_engagement_unique 
  ON average_engagement(platform, min_views, COALESCE(max_views, -1));

-- Index for efficient lookups by platform and view range
CREATE INDEX IF NOT EXISTS idx_average_engagement_lookup 
  ON average_engagement(platform, min_views, max_views);

-- Index for finding tiers for a given view count
CREATE INDEX IF NOT EXISTS idx_average_engagement_view_range 
  ON average_engagement(platform, min_views DESC, max_views DESC NULLS LAST);

-- ============================================================================
-- PART 2: TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE average_engagement IS 
  'Statistical analysis of engagement ratios (likes/comments per view %) grouped by view tier ranges and platform. Used to identify normal vs potentially botted videos.';

COMMENT ON COLUMN average_engagement.platform IS 'Platform: youtube, tiktok, or instagram';
COMMENT ON COLUMN average_engagement.min_views IS 'Lower bound of view tier range (inclusive)';
COMMENT ON COLUMN average_engagement.max_views IS 'Upper bound of view tier range (exclusive, NULL for open-ended)';
COMMENT ON COLUMN average_engagement.video_count IS 'Number of videos in this tier used for calculation (sample size)';

COMMENT ON COLUMN average_engagement.likes_per_view_pct_mean IS 'Average percentage of views that resulted in likes';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_median IS 'Median percentage of views that resulted in likes';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_stddev IS 'Standard deviation of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_p25 IS '25th percentile of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_p75 IS '75th percentile of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_p90 IS '90th percentile of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_p95 IS '95th percentile of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_p99 IS '99th percentile of likes per view percentage';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_min IS 'Minimum likes per view percentage in this tier';
COMMENT ON COLUMN average_engagement.likes_per_view_pct_max IS 'Maximum likes per view percentage in this tier';
COMMENT ON COLUMN average_engagement.likes_per_view_normal_lower IS 'Lower bound of normal range (mean - 2*stddev)';
COMMENT ON COLUMN average_engagement.likes_per_view_normal_upper IS 'Upper bound of normal range (mean + 2*stddev)';

COMMENT ON COLUMN average_engagement.comments_per_view_pct_mean IS 'Average percentage of views that resulted in comments';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_median IS 'Median percentage of views that resulted in comments';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_stddev IS 'Standard deviation of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_p25 IS '25th percentile of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_p75 IS '75th percentile of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_p90 IS '90th percentile of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_p95 IS '95th percentile of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_p99 IS '99th percentile of comments per view percentage';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_min IS 'Minimum comments per view percentage in this tier';
COMMENT ON COLUMN average_engagement.comments_per_view_pct_max IS 'Maximum comments per view percentage in this tier';
COMMENT ON COLUMN average_engagement.comments_per_view_normal_lower IS 'Lower bound of normal range (mean - 2*stddev)';
COMMENT ON COLUMN average_engagement.comments_per_view_normal_upper IS 'Upper bound of normal range (mean + 2*stddev)';

COMMENT ON COLUMN average_engagement.calculated_at IS 'Timestamp when this tier was calculated';
COMMENT ON COLUMN average_engagement.updated_at IS 'Timestamp when this tier was last updated';

-- ============================================================================
-- PART 3: UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_average_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_average_engagement_updated_at
  BEFORE UPDATE ON average_engagement
  FOR EACH ROW
  EXECUTE FUNCTION update_average_engagement_updated_at();

-- ============================================================================
-- PART 4: CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_average_engagement(
  p_min_sample_size INTEGER DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
  v_platform TEXT;
  v_min_views INTEGER;
  v_max_views INTEGER;
  v_video_count INTEGER;
  v_likes_pct_mean NUMERIC;
  v_likes_pct_median NUMERIC;
  v_likes_pct_stddev NUMERIC;
  v_likes_pct_p25 NUMERIC;
  v_likes_pct_p75 NUMERIC;
  v_likes_pct_p90 NUMERIC;
  v_likes_pct_p95 NUMERIC;
  v_likes_pct_p99 NUMERIC;
  v_likes_pct_min NUMERIC;
  v_likes_pct_max NUMERIC;
  v_comments_pct_mean NUMERIC;
  v_comments_pct_median NUMERIC;
  v_comments_pct_stddev NUMERIC;
  v_comments_pct_p25 NUMERIC;
  v_comments_pct_p75 NUMERIC;
  v_comments_pct_p90 NUMERIC;
  v_comments_pct_p95 NUMERIC;
  v_comments_pct_p99 NUMERIC;
  v_comments_pct_min NUMERIC;
  v_comments_pct_max NUMERIC;
  v_tiers_processed INTEGER := 0;
  v_total_rows INTEGER := 0;
  v_platforms_processed INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting average engagement calculation...';
  
  -- Process each platform
  FOR v_platform IN SELECT DISTINCT platform FROM videos_hot WHERE platform IN ('youtube', 'tiktok', 'instagram') LOOP
    RAISE NOTICE 'Processing platform: %', v_platform;
    v_platforms_processed := v_platforms_processed + 1;
    
    -- 1K increments: 0-1K, 1K-2K, ..., 9K-10K (10 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]) LOOP
      v_max_views := v_min_views + 1000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 2K increments: 10K-12K, 12K-14K, ..., 18K-20K (5 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[10000, 12000, 14000, 16000, 18000]) LOOP
      v_max_views := v_min_views + 2000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 5K increments: 20K-25K, 25K-30K, ..., 45K-50K (6 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[20000, 25000, 30000, 35000, 40000, 45000]) LOOP
      v_max_views := v_min_views + 5000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 10K increments: 50K-60K, 60K-70K, ..., 90K-100K (5 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[50000, 60000, 70000, 80000, 90000]) LOOP
      v_max_views := v_min_views + 10000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 100K increments: 100K-200K, 200K-300K, ..., 900K-1M (9 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000]) LOOP
      v_max_views := v_min_views + 100000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 500K increments: 1M-1.5M, 1.5M-2M, ..., 4.5M-5M (8 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 4500000]) LOOP
      v_max_views := v_min_views + 500000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 1M increments: 5M-6M, 6M-7M, ..., 9M-10M (5 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[5000000, 6000000, 7000000, 8000000, 9000000]) LOOP
      v_max_views := v_min_views + 1000000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- 10M increments: 10M-20M, 20M-30M, ..., 90M-100M (9 tiers)
    FOR v_min_views IN SELECT unnest(ARRAY[10000000, 20000000, 30000000, 40000000, 50000000, 60000000, 70000000, 80000000, 90000000]) LOOP
      v_max_views := v_min_views + 10000000;
      PERFORM calculate_tier_stats(v_platform, v_min_views, v_max_views, p_min_sample_size);
      v_tiers_processed := v_tiers_processed + 1;
    END LOOP;
    
    -- Open-ended: 100M+ (1 tier)
    PERFORM calculate_tier_stats(v_platform, 100000000, NULL, p_min_sample_size);
    v_tiers_processed := v_tiers_processed + 1;
    
  END LOOP;
  
  SELECT COUNT(*) INTO v_total_rows FROM average_engagement;
  
  RAISE NOTICE 'Calculation complete. Processed % platforms, % tiers, % total rows in table.', 
    v_platforms_processed, v_tiers_processed, v_total_rows;
  
  RETURN jsonb_build_object(
    'platforms_processed', v_platforms_processed,
    'tiers_processed', v_tiers_processed,
    'total_rows', v_total_rows,
    'calculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: HELPER FUNCTION FOR TIER STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_tier_stats(
  p_platform TEXT,
  p_min_views INTEGER,
  p_max_views INTEGER,
  p_min_sample_size INTEGER DEFAULT 10
) RETURNS void AS $$
DECLARE
  v_video_count INTEGER;
  v_likes_pct_mean NUMERIC;
  v_likes_pct_median NUMERIC;
  v_likes_pct_stddev NUMERIC;
  v_likes_pct_p25 NUMERIC;
  v_likes_pct_p75 NUMERIC;
  v_likes_pct_p90 NUMERIC;
  v_likes_pct_p95 NUMERIC;
  v_likes_pct_p99 NUMERIC;
  v_likes_pct_min NUMERIC;
  v_likes_pct_max NUMERIC;
  v_comments_pct_mean NUMERIC;
  v_comments_pct_median NUMERIC;
  v_comments_pct_stddev NUMERIC;
  v_comments_pct_p25 NUMERIC;
  v_comments_pct_p75 NUMERIC;
  v_comments_pct_p90 NUMERIC;
  v_comments_pct_p95 NUMERIC;
  v_comments_pct_p99 NUMERIC;
  v_comments_pct_min NUMERIC;
  v_comments_pct_max NUMERIC;
  v_likes_ratios NUMERIC[];
  v_comments_ratios NUMERIC[];
BEGIN
  -- Count videos in this tier
  SELECT COUNT(*) INTO v_video_count
  FROM videos_hot
  WHERE platform = p_platform
    AND views_count >= p_min_views
    AND (p_max_views IS NULL OR views_count < p_max_views)
    AND views_count > 0; -- Exclude zero-view videos
  
  -- Skip if insufficient sample size
  IF v_video_count < p_min_sample_size THEN
    RAISE NOTICE 'Skipping tier %-% for platform %: insufficient sample size (%)', 
      p_min_views, COALESCE(p_max_views::TEXT, '∞'), p_platform, v_video_count;
    RETURN;
  END IF;
  
  -- Calculate engagement ratios for all videos in this tier
  WITH engagement_data AS (
    SELECT 
      CASE 
        WHEN views_count > 0 THEN (likes_count::NUMERIC / views_count::NUMERIC) * 100.0
        ELSE NULL
      END AS likes_pct,
      CASE 
        WHEN views_count > 0 THEN (comments_count::NUMERIC / views_count::NUMERIC) * 100.0
        ELSE NULL
      END AS comments_pct
    FROM videos_hot
    WHERE platform = p_platform
      AND views_count >= p_min_views
      AND (p_max_views IS NULL OR views_count < p_max_views)
      AND views_count > 0
  )
  SELECT 
    AVG(likes_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY likes_pct),
    STDDEV_POP(likes_pct),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY likes_pct),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY likes_pct),
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY likes_pct),
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY likes_pct),
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY likes_pct),
    MIN(likes_pct),
    MAX(likes_pct),
    AVG(comments_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY comments_pct),
    STDDEV_POP(comments_pct),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY comments_pct),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY comments_pct),
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY comments_pct),
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY comments_pct),
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY comments_pct),
    MIN(comments_pct),
    MAX(comments_pct)
  INTO 
    v_likes_pct_mean,
    v_likes_pct_median,
    v_likes_pct_stddev,
    v_likes_pct_p25,
    v_likes_pct_p75,
    v_likes_pct_p90,
    v_likes_pct_p95,
    v_likes_pct_p99,
    v_likes_pct_min,
    v_likes_pct_max,
    v_comments_pct_mean,
    v_comments_pct_median,
    v_comments_pct_stddev,
    v_comments_pct_p25,
    v_comments_pct_p75,
    v_comments_pct_p90,
    v_comments_pct_p95,
    v_comments_pct_p99,
    v_comments_pct_min,
    v_comments_pct_max
  FROM engagement_data;
  
  -- Delete existing row if it exists (handles both NULL and non-NULL max_views)
  DELETE FROM average_engagement
  WHERE platform = p_platform
    AND min_views = p_min_views
    AND (max_views IS NULL AND p_max_views IS NULL OR max_views = p_max_views);
  
  -- Insert the tier statistics
  INSERT INTO average_engagement (
    platform,
    min_views,
    max_views,
    video_count,
    likes_per_view_pct_mean,
    likes_per_view_pct_median,
    likes_per_view_pct_stddev,
    likes_per_view_pct_p25,
    likes_per_view_pct_p75,
    likes_per_view_pct_p90,
    likes_per_view_pct_p95,
    likes_per_view_pct_p99,
    likes_per_view_pct_min,
    likes_per_view_pct_max,
    likes_per_view_normal_lower,
    likes_per_view_normal_upper,
    comments_per_view_pct_mean,
    comments_per_view_pct_median,
    comments_per_view_pct_stddev,
    comments_per_view_pct_p25,
    comments_per_view_pct_p75,
    comments_per_view_pct_p90,
    comments_per_view_pct_p95,
    comments_per_view_pct_p99,
    comments_per_view_pct_min,
    comments_per_view_pct_max,
    comments_per_view_normal_lower,
    comments_per_view_normal_upper,
    calculated_at
  ) VALUES (
    p_platform,
    p_min_views,
    p_max_views,
    v_video_count,
    ROUND(v_likes_pct_mean, 6),
    ROUND(v_likes_pct_median, 6),
    ROUND(COALESCE(v_likes_pct_stddev, 0), 6),
    ROUND(v_likes_pct_p25, 6),
    ROUND(v_likes_pct_p75, 6),
    ROUND(v_likes_pct_p90, 6),
    ROUND(v_likes_pct_p95, 6),
    ROUND(v_likes_pct_p99, 6),
    ROUND(v_likes_pct_min, 6),
    ROUND(v_likes_pct_max, 6),
    ROUND(COALESCE(v_likes_pct_mean - 2 * COALESCE(v_likes_pct_stddev, 0), 0), 6),
    ROUND(COALESCE(v_likes_pct_mean + 2 * COALESCE(v_likes_pct_stddev, 0), 0), 6),
    ROUND(v_comments_pct_mean, 6),
    ROUND(v_comments_pct_median, 6),
    ROUND(COALESCE(v_comments_pct_stddev, 0), 6),
    ROUND(v_comments_pct_p25, 6),
    ROUND(v_comments_pct_p75, 6),
    ROUND(v_comments_pct_p90, 6),
    ROUND(v_comments_pct_p95, 6),
    ROUND(v_comments_pct_p99, 6),
    ROUND(v_comments_pct_min, 6),
    ROUND(v_comments_pct_max, 6),
    ROUND(COALESCE(v_comments_pct_mean - 2 * COALESCE(v_comments_pct_stddev, 0), 0), 6),
    ROUND(COALESCE(v_comments_pct_mean + 2 * COALESCE(v_comments_pct_stddev, 0), 0), 6),
    NOW()
  );
  
  RAISE NOTICE 'Processed tier %-% for platform %: % videos', 
    p_min_views, COALESCE(p_max_views::TEXT, '∞'), p_platform, v_video_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_average_engagement(
  p_min_sample_size INTEGER DEFAULT 10
) RETURNS JSONB AS $$
BEGIN
  RAISE NOTICE 'Refreshing average engagement data...';
  
  -- Clear existing data
  DELETE FROM average_engagement;
  
  -- Recalculate all statistics
  RETURN calculate_average_engagement(p_min_sample_size);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: FUNCTION COMMENTS
-- ============================================================================

COMMENT ON FUNCTION calculate_average_engagement IS 
  'Calculate and populate average engagement statistics for all view tiers and platforms. Returns summary JSONB with counts.';

COMMENT ON FUNCTION calculate_tier_stats IS 
  'Helper function to calculate statistics for a single view tier and platform combination.';

COMMENT ON FUNCTION refresh_average_engagement IS 
  'Clear and recalculate all average engagement statistics. Useful for periodic updates.';

-- ============================================================================
-- PART 8: INITIAL DATA POPULATION
-- ============================================================================

-- Populate the table with current data
DO $$
DECLARE
  v_result JSONB;
BEGIN
  RAISE NOTICE 'Populating average_engagement table with initial data...';
  v_result := calculate_average_engagement(10);
  RAISE NOTICE 'Initial population complete: %', v_result;
END;
$$;

