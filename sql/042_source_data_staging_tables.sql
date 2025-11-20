-- ============================================================================
-- SOURCE DATA STAGING TABLES
-- ============================================================================
-- These tables are used to temporarily store data from the source database
-- when schemas don't align perfectly. Data can be transformed and migrated
-- from these staging tables to the final tables.
--
-- Usage: Only create these if schema comparison shows significant differences
-- ============================================================================

-- ============================================================================
-- SOURCE_CREATORS_STAGING
-- ============================================================================
-- Flexible staging table for creator data from source database
-- Accepts any creator-related fields and allows transformation before migration

CREATE TABLE IF NOT EXISTS source_creators_staging (
  -- Primary identifier
  creator_id TEXT PRIMARY KEY,
  
  -- Core fields (matching creators_hot structure)
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_total BIGINT DEFAULT 0,
  bio TEXT,
  bio_links JSONB DEFAULT '[]'::JSONB,
  is_private BOOLEAN DEFAULT FALSE,
  is_business_account BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  first_seen_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional fields that might exist in source (flexible)
  total_play_count BIGINT DEFAULT 0,
  platform TEXT,
  region TEXT,
  language TEXT,
  
  -- Raw data from source (for debugging/transformation)
  source_raw_data JSONB,
  
  -- Migration metadata
  migrated BOOLEAN DEFAULT FALSE,
  migrated_at TIMESTAMP WITH TIME ZONE,
  migration_notes TEXT
);

-- Indexes for staging table
CREATE INDEX IF NOT EXISTS idx_source_creators_staging_username ON source_creators_staging(username);
CREATE INDEX IF NOT EXISTS idx_source_creators_staging_migrated ON source_creators_staging(migrated) WHERE migrated = FALSE;

-- ============================================================================
-- SOURCE_VIDEOS_STAGING
-- ============================================================================
-- Flexible staging table for video data from source database
-- Accepts any video-related fields and allows transformation before migration

CREATE TABLE IF NOT EXISTS source_videos_staging (
  -- Primary identifier
  video_id TEXT PRIMARY KEY,
  post_id TEXT UNIQUE,
  
  -- Foreign key (may need to be created in target first)
  creator_id TEXT NOT NULL,
  
  -- Core fields (matching videos_hot structure)
  url TEXT,
  caption TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  collect_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  video_url TEXT,
  cover_url TEXT,
  thumbnail_url TEXT,
  is_ads BOOLEAN DEFAULT FALSE,
  language TEXT,
  region TEXT,
  
  -- Timestamps
  first_seen_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional fields that might exist in source (flexible)
  platform TEXT,
  digg_count INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  
  -- Raw data from source (for debugging/transformation)
  source_raw_data JSONB,
  
  -- Migration metadata
  migrated BOOLEAN DEFAULT FALSE,
  migrated_at TIMESTAMP WITH TIME ZONE,
  migration_notes TEXT,
  migration_error TEXT
);

-- Indexes for staging table
CREATE INDEX IF NOT EXISTS idx_source_videos_staging_creator_id ON source_videos_staging(creator_id);
CREATE INDEX IF NOT EXISTS idx_source_videos_staging_post_id ON source_videos_staging(post_id);
CREATE INDEX IF NOT EXISTS idx_source_videos_staging_migrated ON source_videos_staging(migrated) WHERE migrated = FALSE;
CREATE INDEX IF NOT EXISTS idx_source_videos_staging_created_at ON source_videos_staging(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to migrate creators from staging to creators_hot
CREATE OR REPLACE FUNCTION migrate_creators_from_staging()
RETURNS TABLE(migrated_count INTEGER, error_count INTEGER) AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT * FROM source_creators_staging WHERE migrated = FALSE
  LOOP
    BEGIN
      -- Insert or update creators_hot
      INSERT INTO creators_hot (
        creator_id, username, display_name, avatar_url, verified,
        followers_count, videos_count, likes_total, bio, bio_links,
        is_private, is_business_account, first_seen_at, last_seen_at, updated_at
      )
      VALUES (
        v_record.creator_id,
        COALESCE(v_record.username, 'unknown'),
        v_record.display_name,
        v_record.avatar_url,
        COALESCE(v_record.verified, FALSE),
        COALESCE(v_record.followers_count, 0),
        COALESCE(v_record.videos_count, 0),
        COALESCE(v_record.likes_total, 0),
        v_record.bio,
        COALESCE(v_record.bio_links, '[]'::JSONB),
        COALESCE(v_record.is_private, FALSE),
        COALESCE(v_record.is_business_account, FALSE),
        COALESCE(v_record.first_seen_at, NOW()),
        COALESCE(v_record.last_seen_at, NOW()),
        NOW()
      )
      ON CONFLICT (creator_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        verified = EXCLUDED.verified,
        followers_count = EXCLUDED.followers_count,
        videos_count = EXCLUDED.videos_count,
        likes_total = EXCLUDED.likes_total,
        bio = EXCLUDED.bio,
        bio_links = EXCLUDED.bio_links,
        is_private = EXCLUDED.is_private,
        is_business_account = EXCLUDED.is_business_account,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW();
      
      -- Mark as migrated
      UPDATE source_creators_staging
      SET migrated = TRUE, migrated_at = NOW()
      WHERE creator_id = v_record.creator_id;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      UPDATE source_creators_staging
      SET migration_error = SQLERRM
      WHERE creator_id = v_record.creator_id;
      
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Function to migrate videos from staging to videos_hot
CREATE OR REPLACE FUNCTION migrate_videos_from_staging()
RETURNS TABLE(migrated_count INTEGER, error_count INTEGER) AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT * FROM source_videos_staging WHERE migrated = FALSE
  LOOP
    BEGIN
      -- Check if creator exists
      IF NOT EXISTS (SELECT 1 FROM creators_hot WHERE creator_id = v_record.creator_id) THEN
        -- Try to create minimal creator record
        INSERT INTO creators_hot (creator_id, username, first_seen_at, last_seen_at, updated_at)
        VALUES (v_record.creator_id, COALESCE(v_record.creator_id, 'unknown'), NOW(), NOW(), NOW())
        ON CONFLICT (creator_id) DO NOTHING;
      END IF;
      
      -- Insert or update videos_hot
      INSERT INTO videos_hot (
        video_id, post_id, creator_id, url, caption, description,
        created_at, views_count, likes_count, comments_count, shares_count,
        collect_count, duration_seconds, video_url, cover_url, thumbnail_url,
        is_ads, language, region, first_seen_at, last_seen_at, updated_at
      )
      VALUES (
        v_record.video_id,
        COALESCE(v_record.post_id, v_record.video_id),
        v_record.creator_id,
        v_record.url,
        v_record.caption,
        v_record.description,
        COALESCE(v_record.created_at, NOW()),
        COALESCE(v_record.views_count, COALESCE(v_record.play_count, 0)),
        COALESCE(v_record.likes_count, COALESCE(v_record.digg_count, 0)),
        COALESCE(v_record.comments_count, 0),
        COALESCE(v_record.shares_count, 0),
        COALESCE(v_record.collect_count, 0),
        v_record.duration_seconds,
        v_record.video_url,
        v_record.cover_url,
        v_record.thumbnail_url,
        COALESCE(v_record.is_ads, FALSE),
        v_record.language,
        v_record.region,
        COALESCE(v_record.first_seen_at, NOW()),
        COALESCE(v_record.last_seen_at, NOW()),
        NOW()
      )
      ON CONFLICT (video_id) DO UPDATE SET
        post_id = EXCLUDED.post_id,
        url = EXCLUDED.url,
        caption = EXCLUDED.caption,
        description = EXCLUDED.description,
        views_count = EXCLUDED.views_count,
        likes_count = EXCLUDED.likes_count,
        comments_count = EXCLUDED.comments_count,
        shares_count = EXCLUDED.shares_count,
        collect_count = EXCLUDED.collect_count,
        video_url = EXCLUDED.video_url,
        cover_url = EXCLUDED.cover_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW();
      
      -- Mark as migrated
      UPDATE source_videos_staging
      SET migrated = TRUE, migrated_at = NOW()
      WHERE video_id = v_record.video_id;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      UPDATE source_videos_staging
      SET migration_error = SQLERRM
      WHERE video_id = v_record.video_id;
      
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================
-- Function to clean up staging tables after successful migration

CREATE OR REPLACE FUNCTION cleanup_staging_tables()
RETURNS void AS $$
BEGIN
  -- Optionally drop staging tables after migration is complete
  -- Uncomment the lines below when ready to clean up:
  -- DROP TABLE IF EXISTS source_videos_staging;
  -- DROP TABLE IF EXISTS source_creators_staging;
  
  -- For now, just log that cleanup would happen
  RAISE NOTICE 'Staging tables cleanup skipped. Uncomment DROP statements in cleanup_staging_tables() when ready.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE source_creators_staging IS 'Staging table for creator data from source database';
COMMENT ON TABLE source_videos_staging IS 'Staging table for video data from source database';
COMMENT ON FUNCTION migrate_creators_from_staging() IS 'Migrates creators from staging table to creators_hot';
COMMENT ON FUNCTION migrate_videos_from_staging() IS 'Migrates videos from staging table to videos_hot';

