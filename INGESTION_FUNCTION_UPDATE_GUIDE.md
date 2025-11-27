# Ingestion Function Update Guide

## Overview

The ingestion function needs to be updated to handle both Instagram and YouTube data structures from Bright Data. The current function only handles Instagram/TikTok-style data.

## Normalization Pipeline

- BrightData payloads are normalized in `src/lib/brightdata-normalizer.ts`. This helper inspects the platform, maps the BrightData metric keys, and emits `normalized_metrics` using our canonical column names (`total_views`, `like_count`, `comment_count`, `share_count`, `save_count`).
- Every ingestion entry point (`src/app/api/brightdata/webhook/route.ts` and `src/app/api/manual-webhook/route.ts`) calls `attachNormalizedMetrics` before invoking `ingest_brightdata_snapshot_v2`, ensuring contest submissions, bypass uploads, and bulk uploads all share the same mapping logic.
- The SQL function should always check `v_element->'normalized_metrics'` first so we rely on a single mapping source and fall back to manual extraction only when older payloads are replayed.

## Required Changes

### 1. Platform Detection
Add platform detection at the start of each record processing:
```sql
v_platform := CASE 
  WHEN v_element->>'url' LIKE '%instagram.com%' THEN 'instagram'
  WHEN v_element->>'url' LIKE '%youtube.com%' OR v_element->>'url' LIKE '%youtu.be%' THEN 'youtube'
  ELSE 'unknown'
END;
```

### 2. Field Extraction Updates

#### Post/Video ID
```sql
-- YouTube
v_post_id := COALESCE(v_element->>'video_id, v_element->>'shortcode');

-- Instagram  
v_post_id := COALESCE(v_element->>'post_id', v_element->>'shortcode');
```

#### Creator ID
```sql
-- YouTube
v_creator_id := COALESCE(v_element->>'youtuber_id', v_element->>'channel_id');

-- Instagram
v_creator_id := COALESCE(v_element->>'user_posted', v_element->>'profile_id');
```

#### Metrics
```sql
-- Always prefer normalized metrics when available
v_normalized_metrics := v_element->'normalized_metrics';
IF v_normalized_metrics IS NOT NULL THEN
  v_new_play_count := (v_normalized_metrics->>'total_views')::INTEGER;
  v_new_likes := (v_normalized_metrics->>'like_count')::INTEGER;
  v_new_comments := (v_normalized_metrics->>'comment_count')::INTEGER;
  v_new_shares := (v_normalized_metrics->>'share_count')::INTEGER;
  v_new_saves := (v_normalized_metrics->>'save_count')::INTEGER;
ELSE
  -- Legacy fallback per-platform (TikTok/Instagram/YouTube)
  -- ...
END IF;
```

#### Hashtags
```sql
-- YouTube: Extract from array of objects
FOR v_hashtag_obj IN SELECT * FROM jsonb_array_elements(v_element->'hashtags')
LOOP
  v_hashtag := LOWER(REPLACE(v_hashtag_obj->>'hashtag', '#', ''));
  -- Process hashtag...
END LOOP;

-- Instagram: Extract from array of strings (or null)
FOR v_hashtag IN SELECT value::TEXT FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
LOOP
  v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
  -- Process hashtag...
END LOOP;
```

#### Music/Sound
```sql
-- YouTube
v_sound_id := COALESCE(
  v_element->'music'->>'song',
  v_element->'music'->>'artist'
);
-- Create composite ID if needed: artist_song

-- Instagram
v_sound_id := COALESCE(
  v_element->'music'->>'id',
  v_element->'music'->>'music_id',
  v_element->>'audio_url'
);
```

#### Creator Profile
```sql
-- YouTube
username := COALESCE(v_element->>'youtuber', '');  -- Remove @ if present
display_name := v_element->>'youtuber';
avatar_url := v_element->>'avatar_img_channel';
followers_count := (v_element->>'subscribers')::INTEGER;

-- Instagram
username := COALESCE(v_element->>'user_posted', '');
display_name := v_element->>'user_posted';
avatar_url := v_element->>'profile_image_link';
followers_count := (v_element->>'followers')::INTEGER;
```

#### Video Details
```sql
-- YouTube
duration_seconds := (v_element->>'video_length')::INTEGER;
cover_url := v_element->>'preview_image';
caption := COALESCE(v_element->>'title', v_element->>'description', '');
created_at := (v_element->>'date_posted')::TIMESTAMP WITH TIME ZONE;

-- Instagram
duration_seconds := COALESCE(
  (v_element->>'length')::NUMERIC::INTEGER,
  (v_element->>'video_length')::INTEGER,
  0
);
cover_url := v_element->>'thumbnail';
caption := COALESCE(v_element->>'description', '');
created_at := (v_element->>'date_posted')::TIMESTAMP WITH TIME ZONE;
```

## Implementation Strategy

1. **Create a new SQL migration file** that replaces the entire function
2. **Add platform detection** at the start of record processing
3. **Use CASE statements** or IF/ELSIF blocks to extract fields based on platform
4. **Update all field references** throughout the function
5. **Test with sample data** from both platforms

## Testing

After updating the function, test with:
1. Sample Instagram webhook payload
2. Sample YouTube webhook payload
3. Verify all fields are extracted correctly
4. Verify hashtag validation works for both formats
5. Verify creator/sound/video records are created correctly

## Next Steps

1. Review the complete `sql/023_admin_bypass_validation.sql` file
2. Create `sql/029_multi_platform_ingestion_complete.sql` with full implementation
3. Update all field extractions to be platform-aware
4. Test with real webhook data

