-- ============================================================================
-- ADMIN BYPASS VALIDATION
-- Adds skip_validation parameter to ingestion function for admin uploads
-- ============================================================================

-- Drop the old function (with 3 parameters) to avoid conflicts
DROP FUNCTION IF EXISTS ingest_brightdata_snapshot_v2(TEXT, TEXT, JSONB);

-- Create the new function with the skip_validation parameter
CREATE OR REPLACE FUNCTION ingest_brightdata_snapshot_v2(
  p_snapshot_id TEXT,
  p_dataset_id TEXT,
  p_payload JSONB,
  p_skip_validation BOOLEAN DEFAULT FALSE  -- NEW: Allow admins to bypass hashtag validation
) RETURNS JSONB AS $$
DECLARE
  v_record JSONB;
  v_post_id TEXT;
  v_creator_id TEXT;
  v_sound_id TEXT;
  v_hashtag TEXT;
  v_results JSONB := '{"processed": 0, "errors": []}'::JSONB;
  v_processed_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_element JSONB;
  v_new_play_count INTEGER;
  v_old_play_count INTEGER := 0;
  v_delta INTEGER;
  -- Duplicate prevention variables
  v_video_url TEXT;
  v_standardized_url TEXT;
  v_is_already_rejected BOOLEAN := FALSE;
  -- Hashtag validation variables
  v_has_edit_hashtag BOOLEAN := FALSE;
  v_hashtag_check TEXT;
  -- Daily aggregation tracking variables
  v_old_likes INTEGER := 0;
  v_old_comments INTEGER := 0;
  v_old_shares INTEGER := 0;
  v_old_impact NUMERIC := 0;
  v_new_likes INTEGER;
  v_new_comments INTEGER;
  v_new_shares INTEGER;
  v_new_impact NUMERIC;
BEGIN
  -- Log start of ingestion
  RAISE NOTICE 'Starting ingestion for snapshot: % (skip_validation: %)', p_snapshot_id, p_skip_validation;
  
  -- Process each record in the payload
  FOR v_element IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    BEGIN
      -- Extract IDs from various possible field names
      v_post_id := COALESCE(
        v_element->>'post_id',
        v_element->>'id',
        v_element->>'video_id'
      );
      
      v_creator_id := COALESCE(
        v_element->>'profile_id',
        v_element->'author'->>'id',
        v_element->'profile'->>'id',
        v_element->>'author_id'
      );
      
      v_sound_id := COALESCE(
        v_element->'music'->>'id',
        v_element->'music'->>'music_id'
      );
      
      -- Skip if missing essential data
      IF v_post_id IS NULL OR v_creator_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'error', 'Missing post_id or creator_id',
          'element', v_element
        );
        CONTINUE;
      END IF;

      -- =======================================================================
      -- DUPLICATE PREVENTION - Check Rejected Videos (CONDITIONAL FOR ADMIN)
      -- =======================================================================
      v_video_url := v_element->>'url';
      
      -- Standardize URL (remove query params)
      v_standardized_url := regexp_replace(
        COALESCE(v_video_url, ''),
        '([\?&].*)?$',
        '',
        'g'
      );
      
      -- Only enforce duplicate prevention if NOT bypassing validation
      -- (Allow admins to rescue rejected videos)
      IF NOT p_skip_validation THEN
        v_is_already_rejected := EXISTS (
          SELECT 1 FROM rejected_videos 
          WHERE standardized_url = v_standardized_url
        );
        
        IF v_is_already_rejected THEN
          RAISE NOTICE 'Video % already rejected, skipping', v_post_id;
          CONTINUE;
        END IF;
      ELSE
        -- Admin bypass: Remove from rejected_videos if present (rescue the video)
        DELETE FROM rejected_videos 
        WHERE standardized_url = v_standardized_url;
        
        RAISE NOTICE 'Admin bypass: Rescued video % from rejected_videos', v_post_id;
      END IF;

      -- =======================================================================
      -- EDIT HASHTAG VALIDATION (CONDITIONAL - CAN BE BYPASSED BY ADMIN)
      -- =======================================================================
      IF NOT p_skip_validation THEN
        -- Standard validation: check for "edit" hashtag
        v_has_edit_hashtag := FALSE;
        
        -- Loop through hashtags to check for "edit"
        FOR v_hashtag_check IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
        LOOP
          v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
          
          -- Check if hashtag contains "edit" (case-insensitive, partial match)
          IF v_hashtag_check LIKE '%edit%' THEN
            v_has_edit_hashtag := TRUE;
            EXIT;  -- Found one, no need to check further
          END IF;
        END LOOP;
        
        -- If no "edit" hashtag found, reject and skip processing
        IF NOT v_has_edit_hashtag THEN
          -- Extract structured data for rejected_videos table
          DECLARE
            v_hashtags_array TEXT[];
            v_hashtag_text TEXT;
            v_rejected_views BIGINT;
            v_rejected_likes BIGINT;
            v_rejected_comments BIGINT;
            v_rejected_shares BIGINT;
            v_rejected_created_at TIMESTAMP WITH TIME ZONE;
            v_rejected_title TEXT;
            v_rejected_description TEXT;
            v_rejected_sound_id TEXT;
            v_rejected_impact NUMERIC;
          BEGIN
            -- Extract hashtags array
            SELECT ARRAY(
              SELECT LOWER(REPLACE(value::TEXT, '#', ''))
              FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
            ) INTO v_hashtags_array;
            
            -- Extract metrics
            v_rejected_views := COALESCE((v_element->>'play_count')::BIGINT, 0);
            v_rejected_likes := COALESCE((v_element->>'digg_count')::BIGINT, 0);
            v_rejected_comments := COALESCE((v_element->>'comment_count')::BIGINT, 0);
            v_rejected_shares := COALESCE((v_element->>'share_count')::BIGINT, 0);
            
            -- Extract video details
            v_rejected_title := COALESCE(v_element->>'description', v_element->>'caption', '');
            v_rejected_description := COALESCE(v_element->>'description', v_element->>'caption', '');
            v_rejected_sound_id := COALESCE(v_element->'music'->>'id', v_element->'music'->>'music_id');
            
            -- Extract created_at
            v_rejected_created_at := COALESCE(
              (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
              to_timestamp((v_element->>'createTime')::BIGINT)
            );
            
            -- Calculate impact score (same formula as videos_hot)
            v_rejected_impact := (
              COALESCE(v_rejected_views, 0) * 1.0 +
              COALESCE(v_rejected_likes, 0) * 10.0 +
              COALESCE(v_rejected_comments, 0) * 20.0 +
              COALESCE(v_rejected_shares, 0) * 30.0
            );
            
            -- Store rejected video with structured data
            INSERT INTO rejected_videos (
              tiktok_url,
              standardized_url,
              rejection_reason,
              original_data,
              post_id,
              creator_id,
              video_id,
              title,
              description,
              views_count,
              likes_count,
              comments_count,
              shares_count,
              video_created_at,
              hashtags,
              sound_id,
              impact_score
            )
            VALUES (
              v_video_url,
              v_standardized_url,
              'No "edit" hashtag found',
              v_element,
              v_post_id,
              v_creator_id,
              v_post_id,
              v_rejected_title,
              v_rejected_description,
              v_rejected_views,
              v_rejected_likes,
              v_rejected_comments,
              v_rejected_shares,
              v_rejected_created_at,
              v_hashtags_array,
              v_rejected_sound_id,
              v_rejected_impact
            )
            ON CONFLICT (standardized_url) DO UPDATE SET
              views_count = EXCLUDED.views_count,
              likes_count = EXCLUDED.likes_count,
              comments_count = EXCLUDED.comments_count,
              shares_count = EXCLUDED.shares_count,
              impact_score = EXCLUDED.impact_score,
              original_data = EXCLUDED.original_data;
            
            -- Check if this rejected video matches any community hashtags
            -- and add to community memberships
            DECLARE
              v_community RECORD;
            BEGIN
              FOR v_community IN 
                SELECT id, linked_hashtags 
                FROM communities 
                WHERE linked_hashtags && v_hashtags_array
              LOOP
                -- Add to community membership as non-edit video
                PERFORM update_community_video_membership_rejected(v_community.id, v_post_id);
              END LOOP;
            EXCEPTION
              WHEN undefined_function THEN
                -- Function not yet available, skip community membership
                NULL;
            END;
            
            -- Skip to next video
            RAISE NOTICE 'Rejected video % - no edit hashtag (added to % communities)', v_post_id, (
              SELECT COUNT(*) FROM communities WHERE linked_hashtags && v_hashtags_array
            );
            CONTINUE;
          END;
        END IF;
      ELSE
        -- Validation bypassed by admin
        RAISE NOTICE 'Validation bypassed by admin for video %', v_post_id;
      END IF;

      -- =======================================================================
      -- UPSERT CREATOR (HOT)
      -- =======================================================================
      INSERT INTO creators_hot (
        creator_id, username, display_name, avatar_url, verified,
        followers_count, bio, updated_at
      )
      VALUES (
        v_creator_id,
        COALESCE(
          v_element->'author'->>'unique_id',
          v_element->'profile'->>'unique_id',
          v_element->>'author_username',
          v_element->>'profile_username',
          v_element->>'account_id'
        ),
        COALESCE(
          v_element->'author'->>'nickname',
          v_element->'profile'->>'nickname',
          v_element->>'author_display_name'
        ),
        COALESCE(
          v_element->'author'->'avatar'->'url_list'->>0,
          v_element->'author'->>'avatar_url',
          v_element->'profile'->'avatar'->'url_list'->>0,
          v_element->>'profile_avatar'
        ),
        COALESCE((v_element->'author'->>'verified')::BOOLEAN, (v_element->>'is_verified')::BOOLEAN, FALSE),
        COALESCE((v_element->'author_stats'->>'follower_count')::INTEGER, (v_element->>'profile_followers')::INTEGER, 0),
        COALESCE(v_element->'author'->>'signature', v_element->>'profile_biography', ''),
        NOW()
      )
      ON CONFLICT (creator_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        verified = EXCLUDED.verified,
        followers_count = EXCLUDED.followers_count,
        bio = EXCLUDED.bio,
        updated_at = EXCLUDED.updated_at;

      -- =======================================================================
      -- UPSERT SOUND (HOT) - Only if sound_id exists
      -- =======================================================================
      IF v_sound_id IS NOT NULL THEN
        INSERT INTO sounds_hot (
          sound_id, sound_title, sound_author, music_duration, music_is_original
        )
        VALUES (
          v_sound_id,
          COALESCE(
            v_element->'music'->>'title',
            v_element->'music'->>'music_title',
            v_element->>'original_sound'
          ),
          COALESCE(
            v_element->'music'->>'authorname',
            v_element->'music'->>'authorName',
            v_element->'music'->>'music_author',
            v_element->>'account_id'
          ),
          COALESCE((v_element->'music'->>'duration')::INTEGER, 0),
          COALESCE((v_element->'music'->>'original')::BOOLEAN, FALSE)
        )
        ON CONFLICT (sound_id) DO UPDATE SET
          last_used_at = NOW(),
          updated_at = NOW();

      END IF;

      -- =======================================================================
      -- PREPARE NEW VALUES & FETCH OLD VALUES FOR DELTA CALCULATION
      -- =======================================================================
      -- Get new metrics from payload
      v_new_play_count := COALESCE((v_element->>'play_count')::INTEGER, 0);
      v_new_likes := COALESCE((v_element->>'digg_count')::INTEGER, 0);
      v_new_comments := COALESCE((v_element->>'comment_count')::INTEGER, 0);
      v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);

      -- Fetch previous play_count from history
      SELECT previous_play_count INTO v_old_play_count
      FROM video_play_count_history
      WHERE video_id = v_post_id;

      -- Fetch old values from existing video (for daily aggregation delta tracking)
      SELECT 
        likes_count, 
        comments_count, 
        shares_count, 
        COALESCE(impact_score, 0)
      INTO 
        v_old_likes, 
        v_old_comments, 
        v_old_shares, 
        v_old_impact
      FROM videos_hot
      WHERE video_id = v_post_id;

      -- If no history or video, set to 0 (this is a new video)
      IF v_old_play_count IS NULL THEN
        v_old_play_count := 0;
      END IF;
      IF v_old_likes IS NULL THEN
        v_old_likes := 0;
        v_old_comments := 0;
        v_old_shares := 0;
        v_old_impact := 0;
      END IF;

      -- Calculate delta
      v_delta := v_new_play_count - v_old_play_count;

      -- =======================================================================
      -- UPSERT VIDEO (HOT) - Use correct schema from 006_hot_tables.sql
      -- =======================================================================
      INSERT INTO videos_hot (
        video_id, post_id, creator_id, url, caption, description,
        created_at, views_count, likes_count, comments_count,
        shares_count, duration_seconds, video_url, cover_url
      )
      VALUES (
        v_post_id,
        v_post_id,
        v_creator_id,
        v_video_url,
        COALESCE(v_element->>'description', v_element->>'caption', ''),
        COALESCE(v_element->>'description', v_element->>'caption', ''),
        COALESCE(
          (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
          to_timestamp((v_element->>'createTime')::BIGINT)
        ),
        v_new_play_count,
        v_new_likes,
        v_new_comments,
        v_new_shares,
        COALESCE((v_element->>'video_duration')::INTEGER, (v_element->>'duration_seconds')::INTEGER, 0),
        COALESCE(v_element->>'video_url', ''),
        COALESCE(v_element->>'preview_image', v_element->>'cover_url', '')
      )
      ON CONFLICT (video_id) DO UPDATE SET
        views_count = EXCLUDED.views_count,
        likes_count = EXCLUDED.likes_count,
        comments_count = EXCLUDED.comments_count,
        shares_count = EXCLUDED.shares_count,
        last_seen_at = NOW(),
        updated_at = NOW();

      -- =======================================================================
      -- UPSERT COLD STORAGE DATA
      -- =======================================================================
      INSERT INTO videos_cold (video_id, full_json, raw_response)
      VALUES (
        v_post_id,
        v_element,
        v_element
      )
      ON CONFLICT (video_id) DO UPDATE SET
        full_json = EXCLUDED.full_json,
        raw_response = EXCLUDED.raw_response,
        updated_at = NOW();

      -- Insert creator cold storage
      BEGIN
        INSERT INTO creator_profiles_cold (creator_id, full_json)
        VALUES (v_creator_id, COALESCE(v_element->'author', v_element->'profile', '{}'::JSONB))
        ON CONFLICT (creator_id) DO UPDATE SET
          full_json = EXCLUDED.full_json,
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;

      -- Also populate creators_cold if it exists
      BEGIN
        INSERT INTO creators_cold (creator_id, full_json, raw_data)
        VALUES (v_creator_id, COALESCE(v_element->'author', v_element->'profile', '{}'::JSONB), v_element)
        ON CONFLICT (creator_id) DO UPDATE SET
          full_json = EXCLUDED.full_json,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;

      -- Insert sound cold storage if sound exists
      IF v_sound_id IS NOT NULL THEN
        BEGIN
          INSERT INTO sounds_cold (sound_id, full_json, music_details)
          VALUES (v_sound_id, v_element->'music', v_element->'music')
          ON CONFLICT (sound_id) DO UPDATE SET
            full_json = EXCLUDED.full_json,
            updated_at = NOW();
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END;
      END IF;

      -- =======================================================================
      -- UPDATE VIDEO PLAY COUNT HISTORY
      -- =======================================================================
      -- Update play count history for next ingestion (delta already calculated above)
      INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
      VALUES (v_post_id, v_new_play_count, NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        previous_play_count = EXCLUDED.previous_play_count,
        last_updated = NOW();

      -- =======================================================================
      -- UPDATE SOUND FACTS AND AGGREGATIONS (DELTA-BASED)
      -- =======================================================================
      -- Now that video exists, create sound fact relationship
      IF v_sound_id IS NOT NULL THEN
        -- Update sound's views_total with delta (if positive)
        IF v_delta > 0 THEN
          UPDATE sounds_hot
          SET views_total = COALESCE(views_total, 0) + v_delta,
              updated_at = NOW()
          WHERE sound_id = v_sound_id;
        END IF;

        -- Create fact relationship (video must exist first!)
        INSERT INTO video_sound_facts (video_id, sound_id, snapshot_at, views_at_snapshot, likes_at_snapshot)
        VALUES (
          v_post_id, 
          v_sound_id, 
          NOW(),
          v_new_play_count,
          v_new_likes
        )
        ON CONFLICT (video_id, sound_id) DO UPDATE SET
          snapshot_at = NOW(),
          views_at_snapshot = EXCLUDED.views_at_snapshot,
          likes_at_snapshot = EXCLUDED.likes_at_snapshot;
      END IF;

      -- =======================================================================
      -- UPDATE CREATOR AGGREGATIONS (DELTA-BASED)
      -- =======================================================================
      -- Update creator's total_play_count with delta (if positive)
      IF v_delta > 0 THEN
        UPDATE creators_hot
        SET total_play_count = COALESCE(total_play_count, 0) + v_delta,
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE creator_id = v_creator_id;
      ELSE
        -- Just update timestamps
        UPDATE creators_hot
        SET last_seen_at = NOW(),
            updated_at = NOW()
        WHERE creator_id = v_creator_id;
      END IF;

      -- =======================================================================
      -- PROCESS HASHTAGS WITH DELTA-BASED UPDATES
      -- =======================================================================
      FOR v_hashtag IN 
        SELECT value::TEXT 
        FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
      LOOP
        -- Normalize hashtag (remove #, lowercase)
        v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
        
        INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
        VALUES (v_hashtag, v_hashtag, NOW())
        ON CONFLICT (hashtag) DO UPDATE SET
          last_seen_at = NOW(),
          updated_at = NOW();

        -- Insert into hashtags_cold if it exists
        BEGIN
          INSERT INTO hashtags_cold (hashtag, raw_data)
          VALUES (v_hashtag, v_element)
          ON CONFLICT (hashtag) DO UPDATE SET
            updated_at = NOW();
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END;

        -- Create fact relationship
        INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
        VALUES (
          v_post_id,
          v_hashtag,
          NOW(),
          v_new_play_count,
          COALESCE((v_element->>'digg_count')::INTEGER, 0)
        )
        ON CONFLICT (video_id, hashtag) DO UPDATE SET
          snapshot_at = NOW(),
          views_at_snapshot = EXCLUDED.views_at_snapshot,
          likes_at_snapshot = EXCLUDED.likes_at_snapshot;

        -- Update hashtag's views_total with delta
        IF v_delta > 0 THEN
          UPDATE hashtags_hot
          SET views_total = COALESCE(views_total, 0) + v_delta,
              updated_at = NOW()
          WHERE hashtag = v_hashtag;
        END IF;
      END LOOP;

      -- =======================================================================
      -- UPDATE COMMUNITY MEMBERSHIPS FOR ACCEPTED VIDEOS
      -- =======================================================================
      BEGIN
        FOR v_hashtag IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
        LOOP
          -- Normalize hashtag
          v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
          
          -- Update communities that include this hashtag
          PERFORM update_community_video_membership(c.id, v_post_id)
          FROM communities c
          WHERE v_hashtag = ANY(c.linked_hashtags);
        END LOOP;
        
        -- Update community totals for all affected communities
        PERFORM update_community_totals(c.id)
        FROM communities c
        WHERE EXISTS (
          SELECT 1 FROM video_hashtag_facts vhf
          WHERE vhf.video_id = v_post_id
            AND vhf.hashtag = ANY(c.linked_hashtags)
        );
      EXCEPTION
        WHEN undefined_table OR undefined_function THEN
          -- Communities feature not yet implemented, skip silently
          NULL;
      END;

      -- =======================================================================
      -- UPDATE DAILY AGGREGATION STATS
      -- =======================================================================
      BEGIN
        -- Get the current impact_score from the newly updated video
        SELECT impact_score INTO v_new_impact
        FROM videos_hot
        WHERE video_id = v_post_id;
        
        -- Update daily aggregation tables (if function exists)
        PERFORM update_daily_aggregates_for_video(
          v_post_id,
          v_old_play_count,
          v_old_likes,
          v_old_comments,
          v_old_shares,
          v_old_impact
        );
      EXCEPTION
        WHEN undefined_function THEN
          -- Function doesn't exist yet, skip daily aggregation
          NULL;
      END;

      v_processed_count := v_processed_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'error', SQLERRM,
          'element', v_element
        );
    END;
  END LOOP;

  -- =======================================================================
  -- UPDATE FINAL AGGREGATIONS
  -- Update video counts, likes totals, and view counts for creators, sounds, and hashtags
  -- =======================================================================
  RAISE NOTICE 'Updating aggregations...';
  BEGIN
    PERFORM update_aggregations();
    RAISE NOTICE 'Aggregation update complete';
  EXCEPTION
    WHEN undefined_function THEN
      -- Function doesn't exist yet, skip
      RAISE NOTICE 'update_aggregations() function not available, skipping final aggregation';
  END;

  -- Log results (note: bd_ingestions table might not exist, wrap in exception handler)
  BEGIN
    INSERT INTO bd_ingestions (
      snapshot_id,
      dataset_id,
      status,
      processed_count,
      error,
      created_at,
      updated_at
    )
    VALUES (
      p_snapshot_id,
      p_dataset_id,
      'completed',
      v_processed_count,
      CASE 
        WHEN jsonb_array_length(v_errors) > 0 THEN v_errors::text
        ELSE NULL
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (snapshot_id) DO UPDATE SET
      status = 'completed',
      processed_count = EXCLUDED.processed_count,
      error = EXCLUDED.error,
      updated_at = NOW();
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist yet, skip logging
      NULL;
    WHEN undefined_column THEN
      -- Column doesn't exist, skip logging
      NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_processed_count,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ingest_brightdata_snapshot_v2 IS 'Process TikTok data into hot/cold storage pattern with optional validation bypass for admin uploads';

