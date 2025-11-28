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
  -- is_edit flag for filtering
  v_is_edit BOOLEAN := FALSE;
  -- Daily aggregation tracking variables
  v_old_likes INTEGER := 0;
  v_old_comments INTEGER := 0;
  v_old_shares INTEGER := 0;
  v_old_saves INTEGER := 0;
  v_old_impact NUMERIC := 0;
  v_new_likes INTEGER;
  v_new_comments INTEGER;
  v_new_shares INTEGER;
  v_new_saves INTEGER;
  v_cover_url TEXT;
  v_new_impact NUMERIC;
  -- Platform detection
  v_platform TEXT;
  v_hashtags_json JSONB;
  v_hashtag_obj JSONB;
  v_url_shortcode TEXT;
  v_normalized_metrics JSONB;
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
      
      -- Allow normalized data to override detected platform/metrics
      IF v_element ? 'normalized_platform' THEN
        v_platform := COALESCE(NULLIF(v_element->>'normalized_platform', ''), v_platform);
      END IF;
      v_normalized_metrics := NULL;
      IF v_element ? 'normalized_metrics' THEN
        v_normalized_metrics := v_element->'normalized_metrics';
      END IF;
      
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
        -- Prefer shortcode over numeric post_id for embeds
        -- Extract shortcode from URL if not in payload: /p/{shortcode} or /reel/{shortcode}
        v_url_shortcode := NULL;
        BEGIN
          -- Try to extract shortcode from URL
          IF v_video_url IS NOT NULL THEN
            v_url_shortcode := (regexp_match(v_video_url, 'instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)'))[2];
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            v_url_shortcode := NULL;
        END;
        
        v_post_id := COALESCE(
          v_element->>'shortcode',  -- Prefer shortcode first (for embeds)
          v_url_shortcode,          -- Extract from URL if available
          v_element->>'post_id',     -- Fallback to numeric post_id
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
      v_hashtags_json := COALESCE(v_element->'normalized_hashtags', v_element->'hashtags');
      IF v_hashtags_json IS NOT NULL AND v_hashtags_json != 'null'::JSONB THEN
        IF v_platform = 'tiktok' OR v_platform = 'instagram' THEN
          -- TikTok and Instagram hashtags: array of strings (but could be string)
          IF jsonb_typeof(v_hashtags_json) = 'array' THEN
            FOR v_hashtag_check IN 
              SELECT value::TEXT 
              FROM jsonb_array_elements_text(v_hashtags_json)
            LOOP
              v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
              IF v_hashtag_check LIKE '%edit%' THEN
                v_has_edit_hashtag := TRUE;
                EXIT;
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
            v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
            END IF;
          END IF;
        ELSIF v_platform = 'youtube' THEN
          -- YouTube hashtags: array of objects with "hashtag" property, or array of strings, or string
          IF jsonb_typeof(v_hashtags_json) = 'array' THEN
            FOR v_hashtag_obj IN SELECT * FROM jsonb_array_elements(v_hashtags_json)
            LOOP
              IF jsonb_typeof(v_hashtag_obj) = 'object' AND v_hashtag_obj ? 'hashtag' THEN
                v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtag_obj->>'hashtag', ''), '#', ''));
              ELSIF jsonb_typeof(v_hashtag_obj) = 'string' THEN
                v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtag_obj::TEXT, ''), '#', ''));
              ELSE
                CONTINUE;
              END IF;
              IF v_hashtag_check LIKE '%edit%' THEN
                v_has_edit_hashtag := TRUE;
                EXIT;
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
            v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
            END IF;
          END IF;
        ELSE
          -- Fallback: try to extract hashtags as array of strings or string
          IF jsonb_typeof(v_hashtags_json) = 'array' THEN
            FOR v_hashtag_check IN 
              SELECT value::TEXT 
              FROM jsonb_array_elements_text(v_hashtags_json)
            LOOP
              v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
              IF v_hashtag_check LIKE '%edit%' THEN
                v_has_edit_hashtag := TRUE;
                EXIT;
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
            v_hashtag_check := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
            IF v_hashtag_check LIKE '%edit%' THEN
              v_has_edit_hashtag := TRUE;
            END IF;
          END IF;
        END IF;
      END IF;
      
      -- =======================================================================
      -- CALCULATE IS_EDIT FLAG
      -- =======================================================================
      -- is_edit = TRUE if:
      --   - Has edit hashtag OR
      --   - Bypassed (p_skip_validation = TRUE)
      -- is_edit = FALSE otherwise
      -- Note: Contest submissions are handled separately via contest webhook
      v_is_edit := v_has_edit_hashtag OR p_skip_validation;
      
      -- If no "edit" hashtag found, reject and skip processing (unless validation is skipped)
      -- Regular uploads must have edit hashtag or be bypassed
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
          v_hashtags_json := COALESCE(v_element->'normalized_hashtags', v_element->'hashtags');
          IF v_hashtags_json IS NOT NULL AND v_hashtags_json != 'null'::JSONB THEN
            IF v_platform = 'youtube' THEN
              IF jsonb_typeof(v_hashtags_json) = 'array' THEN
                SELECT ARRAY(
                  SELECT LOWER(REPLACE(COALESCE(
                    CASE 
                      WHEN jsonb_typeof(obj) = 'object' AND obj ? 'hashtag' THEN obj->>'hashtag'
                      WHEN jsonb_typeof(obj) = 'string' THEN obj::TEXT
                      ELSE NULL
                    END, ''), '#', ''))
                  FROM jsonb_array_elements(v_hashtags_json) obj
                  WHERE (
                    (jsonb_typeof(obj) = 'object' AND obj->>'hashtag' IS NOT NULL) OR
                    (jsonb_typeof(obj) = 'string')
                  )
                ) INTO v_hashtags_array;
              ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
                v_hashtags_array := ARRAY[LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''))];
              ELSE
                v_hashtags_array := ARRAY[]::TEXT[];
              END IF;
            ELSE
              -- TikTok and Instagram: array of strings (but could be string)
              IF jsonb_typeof(v_hashtags_json) = 'array' THEN
                SELECT ARRAY(
                  SELECT LOWER(REPLACE(value::TEXT, '#', ''))
                  FROM jsonb_array_elements_text(v_hashtags_json)
                ) INTO v_hashtags_array;
              ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
                v_hashtags_array := ARRAY[LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''))];
              ELSE
                v_hashtags_array := ARRAY[]::TEXT[];
              END IF;
            END IF;
          ELSE
            v_hashtags_array := ARRAY[]::TEXT[];
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
          
          IF v_normalized_metrics IS NOT NULL THEN
            v_rejected_views := COALESCE((v_normalized_metrics->>'total_views')::BIGINT, v_rejected_views);
            v_rejected_likes := COALESCE((v_normalized_metrics->>'like_count')::BIGINT, v_rejected_likes);
            v_rejected_comments := COALESCE((v_normalized_metrics->>'comment_count')::BIGINT, v_rejected_comments);
            v_rejected_shares := COALESCE((v_normalized_metrics->>'share_count')::BIGINT, v_rejected_shares);
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
          
        -- Calculate impact score (shares/saves excluded to avoid penalizing IG/YT)
        v_rejected_impact := (
          COALESCE(v_rejected_views, 0) * 1.0 +
          COALESCE(v_rejected_likes, 0) * 10.0 +
          COALESCE(v_rejected_comments, 0) * 20.0
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
            total_views,
            like_count,
            comment_count,
            share_count,
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
        v_new_saves := COALESCE(
          (v_element->>'collect_count')::INTEGER,
          (v_element->>'save_count')::INTEGER,
          0
        );
      ELSIF v_platform = 'youtube' THEN
        v_new_play_count := COALESCE((v_element->>'views')::INTEGER, 0);
        v_new_likes := COALESCE((v_element->>'likes')::INTEGER, 0);
        v_new_comments := COALESCE((v_element->>'num_comments')::INTEGER, 0);
        v_new_shares := COALESCE((v_element->>'share_count')::INTEGER, 0);
        v_new_saves := COALESCE(
          (v_element->>'save_count')::INTEGER,
          (v_element->>'collect_count')::INTEGER,
          0
        );
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
        v_new_saves := COALESCE(
          (v_element->>'save_count')::INTEGER,
          (v_element->>'saves')::INTEGER,
          (v_element->>'collect_count')::INTEGER,
          0
        );
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
        v_new_saves := COALESCE(
          (v_element->>'save_count')::INTEGER,
          (v_element->>'collect_count')::INTEGER,
          0
        );
      END IF;
      
      IF v_normalized_metrics IS NOT NULL THEN
        v_new_play_count := COALESCE((v_normalized_metrics->>'total_views')::INTEGER, v_new_play_count);
        v_new_likes := COALESCE((v_normalized_metrics->>'like_count')::INTEGER, v_new_likes);
        v_new_comments := COALESCE((v_normalized_metrics->>'comment_count')::INTEGER, v_new_comments);
        v_new_shares := COALESCE((v_normalized_metrics->>'share_count')::INTEGER, v_new_shares);
        v_new_saves := COALESCE((v_normalized_metrics->>'save_count')::INTEGER, v_new_saves);
      END IF;

      -- =======================================================================
      -- UPSERT CREATOR (HOT) - Platform-aware field extraction
      -- =======================================================================
      INSERT INTO creators_hot (
        creator_id, username, display_name, avatar_url, verified,
        followers_count, bio, updated_at
      )
      VALUES (
        v_creator_id,
        -- Extract username based on platform
        CASE 
          WHEN v_platform = 'tiktok' THEN
            COALESCE(
              v_element->'author'->>'unique_id',
              v_element->'profile'->>'unique_id',
              v_element->>'author_username',
              v_element->>'profile_username',
              v_element->>'account_id',
              v_creator_id  -- Fallback to creator_id if no username found
            )
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              v_element->>'youtuber',
              v_element->>'channel_name',
              v_element->>'youtuber_id',
              v_creator_id
            )
          WHEN v_platform = 'instagram' THEN
            COALESCE(
              v_element->>'user_posted',
              v_element->'author'->>'username',
              v_element->'profile'->>'username',
              v_creator_id
            )
          ELSE
            COALESCE(
              v_element->'author'->>'unique_id',
              v_element->'profile'->>'unique_id',
              v_element->>'author_username',
              v_creator_id
            )
        END,
        -- Extract display name based on platform
        CASE 
          WHEN v_platform = 'tiktok' THEN
            COALESCE(
              v_element->'author'->>'nickname',
              v_element->'profile'->>'nickname',
              v_element->>'author_display_name'
            )
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              v_element->>'channel_name',
              v_element->>'youtuber',
              v_creator_id
            )
          WHEN v_platform = 'instagram' THEN
            COALESCE(
              v_element->'author'->>'full_name',
              v_element->'profile'->>'full_name',
              v_element->>'user_posted'
            )
          ELSE
            COALESCE(
              v_element->'author'->>'nickname',
              v_element->'profile'->>'nickname',
              v_creator_id
            )
        END,
        -- Extract avatar URL based on platform
        CASE 
          WHEN v_platform = 'tiktok' THEN
            COALESCE(
              v_element->'author'->'avatar'->'url_list'->>0,
              v_element->'author'->>'avatar_url',
              v_element->'author'->>'avatarLarger',
              v_element->'profile'->'avatar'->'url_list'->>0,
              v_element->'profile'->>'avatar',
              v_element->>'profile_avatar',
              ''
            )
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              v_element->>'channel_avatar',
              v_element->>'youtuber_avatar',
              ''
            )
          WHEN v_platform = 'instagram' THEN
            COALESCE(
              v_element->'author'->>'profile_pic_url',
              v_element->'profile'->>'profile_pic_url',
              ''
            )
          ELSE
            COALESCE(
              v_element->'author'->'avatar'->'url_list'->>0,
              v_element->'author'->>'avatar_url',
              v_element->'author'->>'avatarLarger',
              v_element->'profile'->>'avatar',
              v_element->>'profile_avatar',
              ''
            )
        END,
        -- Extract verified status
        COALESCE(
          (v_element->'author'->>'verified')::BOOLEAN,
          (v_element->>'is_verified')::BOOLEAN,
          (v_element->>'verified')::BOOLEAN,
          FALSE
        ),
        -- Extract followers count based on platform
        CASE 
          WHEN v_platform = 'tiktok' THEN
            COALESCE(
              (v_element->'author_stats'->>'follower_count')::INTEGER,
              (v_element->>'profile_followers')::INTEGER,
              0
            )
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              (v_element->>'channel_subscribers')::INTEGER,
              (v_element->>'subscribers')::INTEGER,
              0
            )
          WHEN v_platform = 'instagram' THEN
            COALESCE(
              (v_element->'author'->>'follower_count')::INTEGER,
              (v_element->'profile'->>'follower_count')::INTEGER,
              0
            )
          ELSE
            COALESCE(
              (v_element->'author_stats'->>'follower_count')::INTEGER,
              (v_element->>'profile_followers')::INTEGER,
              0
            )
        END,
        -- Extract bio
        COALESCE(
          v_element->'author'->>'signature',
          v_element->>'profile_biography',
          v_element->'profile'->>'biography',
          v_element->>'bio',
          ''
        ),
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
          -- Extract sound title based on platform
          CASE 
            WHEN v_platform = 'youtube' THEN
              COALESCE(
                v_element->'music'->>'song',
                v_element->'music'->>'title',
                v_element->'music'->>'music_title',
                'Unknown'
              )
            WHEN v_platform = 'instagram' THEN
              COALESCE(
                v_element->'music'->>'title',
                v_element->'music'->>'music_title',
                v_element->>'original_sound',
                v_sound_id,  -- Use sound_id as fallback for Instagram
                'Unknown'
              )
            ELSE
              COALESCE(
                v_element->'music'->>'title',
                v_element->'music'->>'music_title',
                v_element->>'original_sound',
                'Unknown'
              )
          END,
          -- Extract sound author based on platform
          CASE 
            WHEN v_platform = 'youtube' THEN
              COALESCE(
                v_element->'music'->>'artist',
                v_element->'music'->>'music_author'
              )
            ELSE
              COALESCE(
                v_element->'music'->>'authorname',
                v_element->'music'->>'authorName',
                v_element->'music'->>'music_author',
                v_element->>'account_id'
              )
          END,
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
      -- Metrics already extracted above (v_new_play_count, v_new_likes, v_new_comments, v_new_shares)

      -- Fetch previous play_count from history
      SELECT previous_play_count INTO v_old_play_count
      FROM video_play_count_history
      WHERE video_id = v_post_id;

      -- Fetch old values from existing video (for daily aggregation delta tracking)
      SELECT 
        likes_count, 
        comments_count, 
        shares_count, 
        collect_count,
        COALESCE(impact_score, 0)
      INTO 
        v_old_likes, 
        v_old_comments, 
        v_old_shares, 
        v_old_saves,
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
        v_old_saves := 0;
        v_old_impact := 0;
      END IF;

      -- Calculate delta
      v_delta := v_new_play_count - v_old_play_count;

      -- Extract cover_url based on platform
      v_cover_url := CASE 
        WHEN v_platform = 'youtube' THEN
          COALESCE(
            v_element->>'thumbnail',
            v_element->>'cover_url',
            ''
          )
        ELSE
          COALESCE(
            v_element->>'preview_image',
            v_element->>'cover_url',
            v_element->>'thumbnail',  -- Instagram uses thumbnail field
            v_element->'author'->>'cover_url',
            ''
          )
      END;

      -- =======================================================================
      -- UPSERT VIDEO (HOT) - Platform-aware field extraction
      -- =======================================================================
      INSERT INTO videos_hot (
        video_id, post_id, creator_id, url, caption, description,
        created_at, views_count, likes_count, comments_count,
        shares_count, collect_count, duration_seconds, video_url, cover_url, platform, is_edit
      )
      VALUES (
        v_post_id,
        v_post_id,
        v_creator_id,
        v_video_url,
        -- Extract caption/description based on platform
        CASE 
          WHEN v_platform = 'youtube' THEN
            COALESCE(v_element->>'title', v_element->>'description', '')
          ELSE
            COALESCE(v_element->>'description', v_element->>'caption', '')
        END,
        CASE 
          WHEN v_platform = 'youtube' THEN
            COALESCE(v_element->>'description', v_element->>'title', '')
          ELSE
            COALESCE(v_element->>'description', v_element->>'caption', '')
        END,
        -- Extract created_at based on platform
        CASE 
          WHEN v_platform = 'tiktok' THEN
            COALESCE(
              (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
              to_timestamp((v_element->>'createTime')::BIGINT)
            )
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              (v_element->>'upload_date')::TIMESTAMP WITH TIME ZONE,
              (v_element->>'created_at')::TIMESTAMP WITH TIME ZONE,
              NOW()
            )
          WHEN v_platform = 'instagram' THEN
            COALESCE(
              (v_element->>'taken_at')::TIMESTAMP WITH TIME ZONE,
              (v_element->>'created_at')::TIMESTAMP WITH TIME ZONE,
              NOW()
            )
          ELSE
            COALESCE(
              (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
              to_timestamp((v_element->>'createTime')::BIGINT),
              NOW()
            )
        END,
        v_new_play_count,
        v_new_likes,
        v_new_comments,
        v_new_shares,
        v_new_saves,
        -- Extract duration based on platform
        CASE 
          WHEN v_platform = 'youtube' THEN
            COALESCE(
              (v_element->>'duration')::INTEGER,
              (v_element->>'video_duration')::INTEGER,
              0
            )
          ELSE
            COALESCE(
              (v_element->>'video_duration')::INTEGER,
              (v_element->>'duration_seconds')::INTEGER,
              0
            )
        END,
        -- Extract video_url
        COALESCE(
          v_element->>'video_url',
          v_element->>'video_play_url',
          ''
        ),
        -- Use extracted cover_url
        v_cover_url,
        -- Store platform
        v_platform,
        -- Set is_edit flag (ensure it's never NULL)
        COALESCE(v_is_edit, FALSE)
      )
      ON CONFLICT (video_id) DO UPDATE SET
        views_count = EXCLUDED.views_count,
        likes_count = EXCLUDED.likes_count,
        comments_count = EXCLUDED.comments_count,
        shares_count = EXCLUDED.shares_count,
        collect_count = EXCLUDED.collect_count,
        cover_url = EXCLUDED.cover_url,
        platform = EXCLUDED.platform,
        is_edit = EXCLUDED.is_edit,
        last_seen_at = NOW(),
        updated_at = NOW();
      
      RAISE NOTICE 'Video % - Successfully INSERTED/UPDATED in videos_hot with is_edit = %', v_post_id, COALESCE(v_is_edit, FALSE);

      -- =======================================================================
      -- UPDATE CONTEST_SUBMISSIONS COVER_URL
      -- Sync cover_url to contest_submissions when videos_hot is updated
      -- =======================================================================
      UPDATE contest_submissions
      SET cover_url = v_cover_url,
      updated_at = NOW()
      WHERE video_hot_id = v_post_id
        AND cover_url IS DISTINCT FROM v_cover_url;

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
          VALUES (
            v_sound_id, 
            COALESCE(v_element->'music', '{}'::JSONB), 
            COALESCE(v_element->'music', '{}'::JSONB)
          )
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
      INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
      VALUES (v_post_id, v_new_play_count, NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        previous_play_count = EXCLUDED.previous_play_count,
        last_updated = NOW();

      -- =======================================================================
      -- UPDATE SOUND FACTS AND AGGREGATIONS (DELTA-BASED)
      -- =======================================================================
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
      -- PROCESS HASHTAGS WITH DELTA-BASED UPDATES - Platform-aware
      -- =======================================================================
      IF v_platform = 'youtube' THEN
        -- YouTube hashtags: could be array of objects, array of strings, or string
        v_hashtags_json := COALESCE(v_element->'normalized_hashtags', v_element->'hashtags');
        IF v_hashtags_json IS NOT NULL AND v_hashtags_json != 'null'::JSONB THEN
          IF jsonb_typeof(v_hashtags_json) = 'array' THEN
            -- Try array of objects first (has "hashtag" property)
            FOR v_hashtag_obj IN SELECT * FROM jsonb_array_elements(v_hashtags_json)
            LOOP
              -- Check if it's an object with "hashtag" property
              IF jsonb_typeof(v_hashtag_obj) = 'object' AND v_hashtag_obj ? 'hashtag' THEN
                v_hashtag := LOWER(REPLACE(COALESCE(v_hashtag_obj->>'hashtag', ''), '#', ''));
              ELSIF jsonb_typeof(v_hashtag_obj) = 'string' THEN
                -- It's an array of strings
                v_hashtag := LOWER(REPLACE(COALESCE(v_hashtag_obj::TEXT, ''), '#', ''));
              ELSE
                CONTINUE;
              END IF;
              
              IF v_hashtag != '' AND v_hashtag != 'null' THEN
                INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
                VALUES (v_hashtag, v_hashtag, NOW())
                ON CONFLICT (hashtag) DO UPDATE SET
                  last_seen_at = NOW(),
                  updated_at = NOW();

                BEGIN
                  INSERT INTO hashtags_cold (hashtag, raw_data)
                  VALUES (v_hashtag, v_element)
                  ON CONFLICT (hashtag) DO UPDATE SET
                    updated_at = NOW();
                EXCEPTION
                  WHEN undefined_table THEN NULL;
                END;

                INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
                VALUES (
                  v_post_id,
                  v_hashtag,
                  NOW(),
                  v_new_play_count,
                  v_new_likes
                )
                ON CONFLICT (video_id, hashtag) DO UPDATE SET
                  snapshot_at = NOW(),
                  views_at_snapshot = EXCLUDED.views_at_snapshot,
                  likes_at_snapshot = EXCLUDED.likes_at_snapshot;

                IF v_delta > 0 THEN
                  UPDATE hashtags_hot
                  SET views_total = COALESCE(views_total, 0) + v_delta,
                      updated_at = NOW()
                  WHERE hashtag = v_hashtag;
                END IF;
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
            -- Single string hashtag
            v_hashtag := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
            IF v_hashtag != '' AND v_hashtag != 'null' THEN
              INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
              VALUES (v_hashtag, v_hashtag, NOW())
              ON CONFLICT (hashtag) DO UPDATE SET
                last_seen_at = NOW(),
                updated_at = NOW();

              BEGIN
                INSERT INTO hashtags_cold (hashtag, raw_data)
                VALUES (v_hashtag, v_element)
                ON CONFLICT (hashtag) DO UPDATE SET
                  updated_at = NOW();
              EXCEPTION
                WHEN undefined_table THEN NULL;
              END;

              INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
              VALUES (
                v_post_id,
                v_hashtag,
                NOW(),
                v_new_play_count,
                v_new_likes
              )
              ON CONFLICT (video_id, hashtag) DO UPDATE SET
                snapshot_at = NOW(),
                views_at_snapshot = EXCLUDED.views_at_snapshot,
                likes_at_snapshot = EXCLUDED.likes_at_snapshot;

              IF v_delta > 0 THEN
                UPDATE hashtags_hot
                SET views_total = COALESCE(views_total, 0) + v_delta,
                    updated_at = NOW()
                WHERE hashtag = v_hashtag;
              END IF;
            END IF;
          END IF;
        END IF;
      ELSE
        -- TikTok and Instagram: array of strings (but could also be string or null)
        v_hashtags_json := COALESCE(v_element->'normalized_hashtags', v_element->'hashtags');
        IF v_hashtags_json IS NOT NULL AND v_hashtags_json != 'null'::JSONB THEN
          IF jsonb_typeof(v_hashtags_json) = 'array' THEN
            FOR v_hashtag IN 
              SELECT value::TEXT 
              FROM jsonb_array_elements_text(v_hashtags_json)
            LOOP
              v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
              IF v_hashtag != '' AND v_hashtag != 'null' THEN
                INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
                VALUES (v_hashtag, v_hashtag, NOW())
                ON CONFLICT (hashtag) DO UPDATE SET
                  last_seen_at = NOW(),
                  updated_at = NOW();

                BEGIN
                  INSERT INTO hashtags_cold (hashtag, raw_data)
                  VALUES (v_hashtag, v_element)
                  ON CONFLICT (hashtag) DO UPDATE SET
                    updated_at = NOW();
                EXCEPTION
                  WHEN undefined_table THEN NULL;
                END;

                INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
                VALUES (
                  v_post_id,
                  v_hashtag,
                  NOW(),
                  v_new_play_count,
                  v_new_likes
                )
                ON CONFLICT (video_id, hashtag) DO UPDATE SET
                  snapshot_at = NOW(),
                  views_at_snapshot = EXCLUDED.views_at_snapshot,
                  likes_at_snapshot = EXCLUDED.likes_at_snapshot;

                IF v_delta > 0 THEN
                  UPDATE hashtags_hot
                  SET views_total = COALESCE(views_total, 0) + v_delta,
                      updated_at = NOW()
                  WHERE hashtag = v_hashtag;
                END IF;
              END IF;
            END LOOP;
          ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
            -- Single string hashtag
            v_hashtag := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
            IF v_hashtag != '' AND v_hashtag != 'null' THEN
              INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
              VALUES (v_hashtag, v_hashtag, NOW())
              ON CONFLICT (hashtag) DO UPDATE SET
                last_seen_at = NOW(),
                updated_at = NOW();

              BEGIN
                INSERT INTO hashtags_cold (hashtag, raw_data)
                VALUES (v_hashtag, v_element)
                ON CONFLICT (hashtag) DO UPDATE SET
                  updated_at = NOW();
              EXCEPTION
                WHEN undefined_table THEN NULL;
              END;

              INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
              VALUES (
                v_post_id,
                v_hashtag,
                NOW(),
                v_new_play_count,
                v_new_likes
              )
              ON CONFLICT (video_id, hashtag) DO UPDATE SET
                snapshot_at = NOW(),
                views_at_snapshot = EXCLUDED.views_at_snapshot,
                likes_at_snapshot = EXCLUDED.likes_at_snapshot;

              IF v_delta > 0 THEN
                UPDATE hashtags_hot
                SET views_total = COALESCE(views_total, 0) + v_delta,
                    updated_at = NOW()
                WHERE hashtag = v_hashtag;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;

      -- =======================================================================
      -- UPDATE COMMUNITY MEMBERSHIPS FOR ACCEPTED VIDEOS
      -- =======================================================================
      BEGIN
        v_hashtags_json := COALESCE(v_element->'normalized_hashtags', v_element->'hashtags');
        IF v_hashtags_json IS NOT NULL AND v_hashtags_json != 'null'::JSONB THEN
          IF v_platform = 'youtube' THEN
            IF jsonb_typeof(v_hashtags_json) = 'array' THEN
              FOR v_hashtag_obj IN SELECT * FROM jsonb_array_elements(v_hashtags_json)
              LOOP
                IF jsonb_typeof(v_hashtag_obj) = 'object' AND v_hashtag_obj ? 'hashtag' THEN
                  v_hashtag := LOWER(REPLACE(COALESCE(v_hashtag_obj->>'hashtag', ''), '#', ''));
                ELSIF jsonb_typeof(v_hashtag_obj) = 'string' THEN
                  v_hashtag := LOWER(REPLACE(COALESCE(v_hashtag_obj::TEXT, ''), '#', ''));
                ELSE
                  CONTINUE;
                END IF;
                IF v_hashtag != '' AND v_hashtag != 'null' THEN
                  PERFORM update_community_video_membership(c.id, v_post_id)
                  FROM communities c
                  WHERE v_hashtag = ANY(c.linked_hashtags);
                END IF;
              END LOOP;
            ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
              v_hashtag := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
              IF v_hashtag != '' AND v_hashtag != 'null' THEN
                PERFORM update_community_video_membership(c.id, v_post_id)
                FROM communities c
                WHERE v_hashtag = ANY(c.linked_hashtags);
              END IF;
            END IF;
          ELSE
            IF jsonb_typeof(v_hashtags_json) = 'array' THEN
              FOR v_hashtag IN 
                SELECT value::TEXT 
                FROM jsonb_array_elements_text(v_hashtags_json)
              LOOP
                v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
                IF v_hashtag != '' AND v_hashtag != 'null' THEN
                  PERFORM update_community_video_membership(c.id, v_post_id)
                  FROM communities c
                  WHERE v_hashtag = ANY(c.linked_hashtags);
                END IF;
              END LOOP;
            ELSIF jsonb_typeof(v_hashtags_json) = 'string' THEN
              v_hashtag := LOWER(REPLACE(COALESCE(v_hashtags_json::TEXT, ''), '#', ''));
              IF v_hashtag != '' AND v_hashtag != 'null' THEN
                PERFORM update_community_video_membership(c.id, v_post_id)
                FROM communities c
                WHERE v_hashtag = ANY(c.linked_hashtags);
              END IF;
            END IF;
          END IF;
        END IF;
        
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

        -- Calculate deltas for daily aggregation
        INSERT INTO daily_video_aggregations (
          video_id,
          date,
          views_delta,
          likes_delta,
          comments_delta,
          shares_delta,
          impact_delta
        )
        VALUES (
          v_post_id,
          CURRENT_DATE,
          v_delta,
          v_new_likes - v_old_likes,
          v_new_comments - v_old_comments,
          v_new_shares - v_old_shares,
          v_new_impact - v_old_impact
        )
        ON CONFLICT (video_id, date) DO UPDATE SET
          views_delta = daily_video_aggregations.views_delta + EXCLUDED.views_delta,
          likes_delta = daily_video_aggregations.likes_delta + EXCLUDED.likes_delta,
          comments_delta = daily_video_aggregations.comments_delta + EXCLUDED.comments_delta,
          shares_delta = daily_video_aggregations.shares_delta + EXCLUDED.shares_delta,
          impact_delta = daily_video_aggregations.impact_delta + EXCLUDED.impact_delta,
          updated_at = NOW();
      EXCEPTION
        WHEN undefined_table THEN
          -- Daily aggregation table not yet implemented, skip silently
          NULL;
      END;

      RAISE NOTICE 'Successfully processed video % (platform: %)', v_post_id, v_platform;
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
  
  -- =======================================================================
  -- UPDATE AGGREGATIONS
  -- Update video counts, likes totals, view counts, and impact scores for creators, sounds, and hashtags
  -- =======================================================================
  RAISE NOTICE 'Updating aggregations...';
  BEGIN
    PERFORM update_aggregations();
    RAISE NOTICE 'Aggregation update complete';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE WARNING 'update_aggregations() function not found. Creator stats may not be updated.';
    WHEN OTHERS THEN
      RAISE WARNING 'Error updating aggregations: %', SQLERRM;
  END;
  
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

