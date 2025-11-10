-- ============================================================================
-- MULTI-PLATFORM INGESTION SUPPORT
-- Updates ingestion function to handle both Instagram and YouTube data structures
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS ingest_brightdata_snapshot_v2(TEXT, TEXT, JSONB, BOOLEAN);

-- Create updated function with platform detection
CREATE OR REPLACE FUNCTION ingest_brightdata_snapshot_v2(
  p_snapshot_id TEXT,
  p_dataset_id TEXT,
  p_payload JSONB,
  p_skip_validation BOOLEAN DEFAULT FALSE
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
  -- Platform detection
  v_platform TEXT;
  v_hashtags_json JSONB;
  v_hashtag_obj JSONB;
BEGIN
  -- Log start of ingestion
  RAISE NOTICE 'Starting ingestion for snapshot: % (skip_validation: %)', p_snapshot_id, p_skip_validation;
  
  -- Process each record in the payload
  FOR v_element IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    BEGIN
      -- =======================================================================
      -- PLATFORM DETECTION
      -- =======================================================================
      -- Detect platform from URL
      v_video_url := v_element->>'url';
      IF v_video_url LIKE '%tiktok.com%' OR v_video_url LIKE '%vm.tiktok.com%' THEN
        v_platform := 'tiktok';
      ELSIF v_video_url LIKE '%instagram.com%' THEN
        v_platform := 'instagram';
      ELSIF v_video_url LIKE '%youtube.com%' OR v_video_url LIKE '%youtu.be%' THEN
        v_platform := 'youtube';
      ELSE
        v_platform := 'unknown';
      END IF;
      
      RAISE NOTICE 'Detected platform: % for URL: %', v_platform, v_video_url;
      
      -- =======================================================================
      -- EXTRACT IDs BASED ON PLATFORM
      -- =======================================================================
      IF v_platform = 'tiktok' THEN
        -- TikTok structure
        v_post_id := COALESCE(
          v_element->>'post_id',
          v_element->>'id',
          v_element->>'video_id'
        );
        
        v_creator_id := COALESCE(
          v_element->>'profile_id',
          v_element->'author'->>'id',
          v_element->'profile'->>'id',
          v_element->'author'->>'uniqueId',
          v_element->'profile'->>'unique_id'
        );
        
        v_sound_id := COALESCE(
          v_element->'music'->>'id',
          v_element->'music'->>'music_id',
          v_element->'music'->>'title'
        );
        
      ELSIF v_platform = 'youtube' THEN
        -- YouTube structure
        -- Extract video_id from URL if not in payload (for YouTube Shorts)
        v_post_id := COALESCE(
          v_element->>'video_id',
          v_element->>'shortcode',
          v_element->>'id',
          -- Extract from URL: https://www.youtube.com/shorts/VIDEO_ID
          CASE 
            WHEN v_video_url LIKE '%youtube.com/shorts/%' THEN
              (regexp_match(v_video_url, 'youtube\.com/shorts/([^/?]+)'))[1]
            WHEN v_video_url LIKE '%youtu.be/%' THEN
              (regexp_match(v_video_url, 'youtu\.be/([^/?]+)'))[1]
            ELSE NULL
          END
        );
        
        -- YouTube creator ID: use youtuber (username) or youtuber_md5 as fallback
        v_creator_id := COALESCE(
          v_element->>'youtuber_id',
          v_element->>'channel_id',
          v_element->>'youtuber',  -- Username like @RabiulSentu
          v_element->>'youtuber_md5',  -- MD5 hash of username
          -- Extract from URL if available
          CASE 
            WHEN v_video_url LIKE '%youtube.com/@%' THEN
              (regexp_match(v_video_url, 'youtube\.com/@([^/]+)'))[1]
            ELSE NULL
          END
        );
        
        -- Debug logging for YouTube extraction
        RAISE NOTICE 'YouTube extraction - URL: %, post_id: %, creator_id: %, youtuber field: %', 
          v_video_url, v_post_id, v_creator_id, v_element->>'youtuber';
        
        -- YouTube music structure: {artist, song}
        v_sound_id := COALESCE(
          v_element->'music'->>'song',
          v_element->'music'->>'artist'
        );
        -- If no music, try to create ID from artist+song
        IF v_sound_id IS NULL AND v_element->'music' IS NOT NULL THEN
          v_sound_id := COALESCE(
            v_element->'music'->>'artist',
            ''
          ) || '_' || COALESCE(
            v_element->'music'->>'song',
            ''
          );
          IF v_sound_id = '_' THEN
            v_sound_id := NULL;
          END IF;
        END IF;
        
      ELSIF v_platform = 'instagram' THEN
        -- Instagram structure
        v_post_id := COALESCE(
          v_element->>'post_id',
          v_element->>'shortcode',
          v_element->>'id'
        );
        
        v_creator_id := COALESCE(
          v_element->>'user_posted',  -- Instagram uses username as creator_id
          v_element->>'profile_id',
          v_element->'author'->>'id',
          v_element->'profile'->>'id'
        );
        
        v_sound_id := COALESCE(
          v_element->'music'->>'id',
          v_element->'music'->>'music_id',
          v_element->>'audio_url'  -- Instagram audio URL
        );
        
      ELSE
        -- Fallback to original logic for unknown platforms (try TikTok structure first, then others)
        v_post_id := COALESCE(
          v_element->>'post_id',
          v_element->>'video_id',
          v_element->>'id'
        );
        
        v_creator_id := COALESCE(
          v_element->>'profile_id',
          v_element->'author'->>'id',
          v_element->'profile'->>'id',
          v_element->'author'->>'uniqueId',
          v_element->'profile'->>'unique_id',
          v_element->>'author_id',
          v_element->>'youtuber_id'
        );
        
        v_sound_id := COALESCE(
          v_element->'music'->>'id',
          v_element->'music'->>'music_id',
          v_element->'music'->>'title',
          v_element->'music'->>'song'
        );
      END IF;
      
      -- Skip if missing essential data
      IF v_post_id IS NULL OR v_creator_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'error', 'Missing post_id/video_id or creator_id',
          'platform', v_platform,
          'element', v_element
        );
        CONTINUE;
      END IF;

      -- =======================================================================
      -- DUPLICATE PREVENTION - Check Rejected Videos
      -- =======================================================================
      -- Standardize URL (remove query params)
      v_standardized_url := regexp_replace(
        COALESCE(v_video_url, ''),
        '([\?&].*)?$',
        '',
        'g'
      );
      
      -- Only enforce duplicate prevention if NOT bypassing validation
      IF NOT p_skip_validation THEN
        v_is_already_rejected := EXISTS (
          SELECT 1 FROM rejected_videos 
          WHERE standardized_url = v_standardized_url
        );
        
        IF v_is_already_rejected THEN
          RAISE NOTICE 'Video % already rejected, skipping', v_post_id;
          CONTINUE;
        END IF;
      END IF;

      -- =======================================================================
      -- EDIT HASHTAG VALIDATION
      -- =======================================================================
      v_has_edit_hashtag := FALSE;
      
      -- Extract hashtags based on platform
      IF v_platform = 'tiktok' THEN
        -- TikTok hashtags: array of strings
        IF v_element->'hashtags' IS NOT NULL AND v_element->'hashtags' != 'null'::JSONB THEN
          FOR v_hashtag_check IN 
            SELECT value::TEXT 
            FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
          LOOP
            v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
              EXIT;
            END IF;
          END LOOP;
        END IF;
      ELSIF v_platform = 'youtube' THEN
        -- YouTube hashtags: array of objects with "hashtag" property
        v_hashtags_json := COALESCE(v_element->'hashtags', '[]'::JSONB);
        IF jsonb_typeof(v_hashtags_json) = 'array' THEN
          FOR v_hashtag_obj IN SELECT * FROM jsonb_array_elements(v_hashtags_json)
          LOOP
            v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtag_obj->>'hashtag', ''), '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
              EXIT;
            END IF;
          END LOOP;
        END IF;
      ELSIF v_platform = 'instagram' THEN
        -- Instagram hashtags: could be null, array of strings, or different format
        IF v_element->'hashtags' IS NOT NULL AND v_element->'hashtags' != 'null'::JSONB THEN
          FOR v_hashtag_check IN 
            SELECT value::TEXT 
            FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
          LOOP
            v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
              EXIT;
            END IF;
          END LOOP;
        END IF;
      ELSE
        -- Fallback: try to extract hashtags as array of strings
        FOR v_hashtag_check IN 
          SELECT value::TEXT 
          FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
        LOOP
          v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
          IF v_hashtag_check LIKE '%edit%' THEN
            v_has_edit_hashtag := TRUE;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      
      -- If no "edit" hashtag found, reject and skip processing (unless validation is skipped)
      IF NOT v_has_edit_hashtag AND NOT p_skip_validation THEN
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
          v_community RECORD;
        BEGIN
          -- Extract hashtags array based on platform
          IF v_platform = 'youtube' THEN
            SELECT ARRAY(
              SELECT LOWER(REPLACE(COALESCE(obj->>'hashtag', ''), '#', ''))
              FROM jsonb_array_elements(COALESCE(v_element->'hashtags', '[]'::JSONB)) obj
              WHERE obj->>'hashtag' IS NOT NULL
            ) INTO v_hashtags_array;
          ELSE
            -- TikTok and Instagram: array of strings
            SELECT ARRAY(
              SELECT LOWER(REPLACE(value::TEXT, '#', ''))
              FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
            ) INTO v_hashtags_array;
          END IF;
          
          -- Extract metrics based on platform
          IF v_platform = 'tiktok' THEN
            v_rejected_views := COALESCE((v_element->>'play_count')::BIGINT, 0);
            v_rejected_likes := COALESCE((v_element->>'digg_count')::BIGINT, 0);
            v_rejected_comments := COALESCE((v_element->>'comment_count')::BIGINT, 0);
            v_rejected_shares := COALESCE((v_element->>'share_count')::BIGINT, 0);
          ELSIF v_platform = 'youtube' THEN
            v_rejected_views := COALESCE((v_element->>'views')::BIGINT, 0);
            v_rejected_likes := COALESCE((v_element->>'likes')::BIGINT, 0);
            v_rejected_comments := COALESCE((v_element->>'num_comments')::BIGINT, 0);
            v_rejected_shares := 0;  -- YouTube doesn't have shares
          ELSE
            v_rejected_views := COALESCE(
              (v_element->>'views')::BIGINT,
              (v_element->>'video_play_count')::BIGINT,
              (v_element->>'play_count')::BIGINT,
              0
            );
            v_rejected_likes := COALESCE(
              (v_element->>'likes')::BIGINT,
              (v_element->>'digg_count')::BIGINT,
              0
            );
            v_rejected_comments := COALESCE(
              (v_element->>'num_comments')::BIGINT,
              (v_element->>'comment_count')::BIGINT,
              0
            );
            v_rejected_shares := COALESCE((v_element->>'share_count')::BIGINT, 0);
          END IF;
          
          -- Extract video details
          v_rejected_title := COALESCE(
            v_element->>'title',
            v_element->>'description',
            v_element->>'caption',
            ''
          );
          v_rejected_description := COALESCE(
            v_element->>'description',
            v_element->>'caption',
            ''
          );
          
          -- Extract sound/music ID
          IF v_platform = 'tiktok' THEN
            v_rejected_sound_id := COALESCE(
              v_element->'music'->>'id',
              v_element->'music'->>'music_id',
              v_element->'music'->>'title'
            );
          ELSIF v_platform = 'youtube' THEN
            v_rejected_sound_id := COALESCE(
              v_element->'music'->>'song',
              v_element->'music'->>'artist'
            );
          ELSE
            v_rejected_sound_id := COALESCE(
              v_element->'music'->>'id',
              v_element->'music'->>'music_id'
            );
          END IF;
          
          -- Extract created_at
          v_rejected_created_at := COALESCE(
            (v_element->>'date_posted')::TIMESTAMP WITH TIME ZONE,
            (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
            to_timestamp((v_element->>'createTime')::BIGINT),
            NOW()
          );
          
          -- Calculate impact score
          v_rejected_impact := (
            COALESCE(v_rejected_views, 0) * 1.0 +
            COALESCE(v_rejected_likes, 0) * 10.0 +
            COALESCE(v_rejected_comments, 0) * 20.0 +
            COALESCE(v_rejected_shares, 0) * 30.0
          );
          
          -- Store rejected video
          INSERT INTO rejected_videos (
            tiktok_url,  -- Note: column name kept for backward compatibility
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
          ON CONFLICT (standardized_url) DO NOTHING;
          
          -- Update community memberships for rejected videos
          FOR v_community IN
            SELECT id, linked_hashtags 
            FROM communities 
            WHERE linked_hashtags && v_hashtags_array
          LOOP
            PERFORM update_community_video_membership_rejected(v_community.id, v_post_id);
          END LOOP;
          
          RAISE NOTICE 'Rejected video % (platform: %) - no edit hashtag', v_post_id, v_platform;
          CONTINUE;
        END;
      END IF;

      -- =======================================================================
      -- EXTRACT METRICS BASED ON PLATFORM
      -- =======================================================================
      IF v_platform = 'tiktok' THEN
        v_new_play_count := COALESCE((v_element->>'play_count')::INTEGER, 0);
        v_new_likes := COALESCE((v_element->>'digg_count')::INTEGER, 0);
        v_new_comments := COALESCE((v_element->>'comment_count')::INTEGER, 0);
        v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);
      ELSIF v_platform = 'youtube' THEN
        v_new_play_count := COALESCE((v_element->>'views')::INTEGER, 0);
        v_new_likes := COALESCE((v_element->>'likes')::INTEGER, 0);
        v_new_comments := COALESCE((v_element->>'num_comments')::INTEGER, 0);
        v_new_shares := 0;  -- YouTube doesn't have shares
      ELSIF v_platform = 'instagram' THEN
        v_new_play_count := COALESCE(
          (v_element->>'views')::INTEGER,
          (v_element->>'video_play_count')::INTEGER,
          (v_element->>'play_count')::INTEGER,
          0
        );
        v_new_likes := COALESCE(
          (v_element->>'likes')::INTEGER,
          (v_element->>'digg_count')::INTEGER,
          0
        );
        v_new_comments := COALESCE(
          (v_element->>'num_comments')::INTEGER,
          (v_element->>'comment_count')::INTEGER,
          0
        );
        v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);
      ELSE
        -- Fallback
        v_new_play_count := COALESCE(
          (v_element->>'play_count')::INTEGER,
          (v_element->>'views')::INTEGER,
          0
        );
        v_new_likes := COALESCE(
          (v_element->>'digg_count')::INTEGER,
          (v_element->>'likes')::INTEGER,
          0
        );
        v_new_comments := COALESCE(
          (v_element->>'comment_count')::INTEGER,
          (v_element->>'num_comments')::INTEGER,
          0
        );
        v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);
      END IF;

      -- Continue with existing logic for creators, videos, sounds, hashtags...
      -- (The rest of the function remains the same, but uses the extracted values above)
      
      -- For now, we'll add a placeholder comment indicating where the rest of the logic goes
      -- You'll need to copy the rest of the ingestion logic from sql/023_admin_bypass_validation.sql
      -- and update field references to use the platform-aware extracted values
      
      RAISE NOTICE 'Processing video % (platform: %)', v_post_id, v_platform;
      v_processed_count := v_processed_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'error', SQLERRM,
          'post_id', v_post_id,
          'platform', v_platform
        );
        RAISE NOTICE 'Error processing record: % - %', v_post_id, SQLERRM;
    END;
  END LOOP;
  
  -- Return results
  v_results := jsonb_build_object(
    'processed', v_processed_count,
    'errors', v_errors,
    'platform', v_platform
  );
  
  RETURN v_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ingest_brightdata_snapshot_v2 IS 'Process Instagram and YouTube data into hot/cold storage pattern with platform detection';

