-- Backfill Rejected Videos with Structured Data and Community Memberships
-- This script:
-- 1. Extracts structured data from original_data JSONB for all existing rejected_videos
-- 2. Updates all rows with new column values
-- 3. Adds rejected videos to community memberships where hashtags match

-- ============================================================================
-- STEP 1: Update existing rejected_videos with structured data
-- ============================================================================

DO $$
DECLARE
  v_record RECORD;
  v_hashtags_array TEXT[];
  v_rejected_views BIGINT;
  v_rejected_likes BIGINT;
  v_rejected_comments BIGINT;
  v_rejected_shares BIGINT;
  v_rejected_created_at TIMESTAMP WITH TIME ZONE;
  v_rejected_title TEXT;
  v_rejected_description TEXT;
  v_rejected_sound_id TEXT;
  v_rejected_impact NUMERIC;
  v_updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of rejected_videos table...';
  
  -- Process each rejected video
  FOR v_record IN 
    SELECT id, post_id, original_data 
    FROM rejected_videos 
    WHERE video_id IS NULL OR hashtags IS NULL
  LOOP
    BEGIN
      -- Extract hashtags array
      SELECT ARRAY(
        SELECT LOWER(REPLACE(value::TEXT, '#', ''))
        FROM jsonb_array_elements_text(COALESCE(v_record.original_data->'hashtags', '[]'::JSONB))
      ) INTO v_hashtags_array;
      
      -- Extract metrics
      v_rejected_views := COALESCE((v_record.original_data->>'play_count')::BIGINT, 0);
      v_rejected_likes := COALESCE((v_record.original_data->>'digg_count')::BIGINT, 0);
      v_rejected_comments := COALESCE((v_record.original_data->>'comment_count')::BIGINT, 0);
      v_rejected_shares := COALESCE((v_record.original_data->>'share_count')::BIGINT, 0);
      
      -- Extract video details
      v_rejected_title := COALESCE(
        v_record.original_data->>'description', 
        v_record.original_data->>'caption', 
        ''
      );
      v_rejected_description := COALESCE(
        v_record.original_data->>'description', 
        v_record.original_data->>'caption', 
        ''
      );
      v_rejected_sound_id := COALESCE(
        v_record.original_data->'music'->>'id', 
        v_record.original_data->'music'->>'music_id'
      );
      
      -- Extract created_at
      v_rejected_created_at := COALESCE(
        (v_record.original_data->>'create_time')::TIMESTAMP WITH TIME ZONE,
        to_timestamp((v_record.original_data->>'createTime')::BIGINT)
      );
      
      -- Calculate impact score
      v_rejected_impact := (
        COALESCE(v_rejected_views, 0) * 1.0 +
        COALESCE(v_rejected_likes, 0) * 10.0 +
        COALESCE(v_rejected_comments, 0) * 20.0 +
        COALESCE(v_rejected_shares, 0) * 30.0
      );
      
      -- Update the record
      UPDATE rejected_videos
      SET 
        video_id = v_record.post_id,
        title = v_rejected_title,
        description = v_rejected_description,
        views_count = v_rejected_views,
        likes_count = v_rejected_likes,
        comments_count = v_rejected_comments,
        shares_count = v_rejected_shares,
        video_created_at = v_rejected_created_at,
        hashtags = v_hashtags_array,
        sound_id = v_rejected_sound_id,
        impact_score = v_rejected_impact
      WHERE id = v_record.id;
      
      v_updated_count := v_updated_count + 1;
      
      -- Log progress every 100 records
      IF v_updated_count % 100 = 0 THEN
        RAISE NOTICE 'Updated % rejected videos...', v_updated_count;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing rejected video %: %', v_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Completed: Updated % rejected videos with structured data', v_updated_count;
END $$;

-- ============================================================================
-- STEP 2: Add rejected videos to community memberships
-- ============================================================================

DO $$
DECLARE
  v_community RECORD;
  v_result JSONB;
  v_total_added INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of community memberships with rejected videos...';
  
  -- Process each community
  FOR v_community IN SELECT id, name, slug, linked_hashtags FROM communities ORDER BY name
  LOOP
    RAISE NOTICE 'Processing community: % (%)...', v_community.name, v_community.slug;
    
    -- Backfill rejected videos for this community
    SELECT backfill_community_rejected_videos(v_community.id) INTO v_result;
    
    RAISE NOTICE 'Community %: %', v_community.name, v_result;
    
    v_total_added := v_total_added + COALESCE((v_result->>'rejected_videos_processed')::INTEGER, 0);
  END LOOP;
  
  RAISE NOTICE 'Completed: Added % rejected videos to community memberships', v_total_added;
END $$;

-- ============================================================================
-- STEP 3: Verify results
-- ============================================================================

-- Show summary statistics
SELECT 
  'Total Rejected Videos' as metric,
  COUNT(*) as count
FROM rejected_videos
UNION ALL
SELECT 
  'Rejected Videos with Structured Data',
  COUNT(*)
FROM rejected_videos
WHERE video_id IS NOT NULL AND hashtags IS NOT NULL
UNION ALL
SELECT 
  'Rejected Videos in Community Memberships',
  COUNT(DISTINCT video_id)
FROM community_video_memberships
WHERE is_edit_video = FALSE
UNION ALL
SELECT 
  'Communities with Rejected Videos',
  COUNT(DISTINCT community_id)
FROM community_video_memberships
WHERE is_edit_video = FALSE;

-- Show per-community breakdown
SELECT 
  c.name,
  c.slug,
  COUNT(CASE WHEN cvm.is_edit_video = TRUE THEN 1 END) as edit_videos,
  COUNT(CASE WHEN cvm.is_edit_video = FALSE THEN 1 END) as non_edit_videos,
  COUNT(*) as total_videos,
  c.total_views,
  c.total_creators
FROM communities c
LEFT JOIN community_video_memberships cvm ON cvm.community_id = c.id
GROUP BY c.id, c.name, c.slug, c.total_views, c.total_creators
ORDER BY total_videos DESC;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE 'Backfill complete! Check the results above.';
END $$;

