-- Migration: Add backfill function for campaigns (same logic as communities)
-- This allows campaigns to populate videos/creators/hashtags from linked_hashtags

-- ============================================================================
-- FUNCTION: backfill_campaign
-- Backfills a campaign's data from existing videos matching linked_hashtags
-- Works exactly like backfill_community but for campaigns table
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_campaign(p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hashtags TEXT[];
  v_video RECORD;
  v_count INTEGER := 0;
  v_video_ids TEXT[] := '{}';
BEGIN
  -- Get campaign hashtags from linked_hashtags (TEXT[])
  SELECT linked_hashtags INTO v_hashtags
  FROM campaigns
  WHERE id = p_campaign_id;
  
  -- Fallback to hashtags JSONB if linked_hashtags is empty (for backwards compatibility)
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(hashtags)
    ) INTO v_hashtags
    FROM campaigns
    WHERE id = p_campaign_id;
  END IF;
  
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No hashtags linked to campaign');
  END IF;
  
  -- Find all videos matching any of the campaign hashtags
  FOR v_video IN 
    SELECT DISTINCT v.video_id
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = ANY(v_hashtags)
  LOOP
    v_video_ids := array_append(v_video_ids, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update campaign with video_ids
  UPDATE campaigns
  SET video_ids = to_jsonb(v_video_ids)
  WHERE id = p_campaign_id;
  
  RETURN jsonb_build_object('success', true, 'videos_processed', v_count, 'video_count', array_length(v_video_ids, 1));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_campaign IS 'Backfills a campaign by finding all videos matching linked_hashtags and updating video_ids';

