-- ============================================================================
-- MANUAL AGGREGATION FIX
-- Run this to manually update all aggregations after ingestion
-- ============================================================================

-- Step 1: Check if data exists in raw tables
DO $$
DECLARE
  v_video_count INTEGER;
  v_creator_count INTEGER;
  v_hashtag_count INTEGER;
  v_sound_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_video_count FROM videos_hot;
  SELECT COUNT(*) INTO v_creator_count FROM creators_hot;
  SELECT COUNT(*) INTO v_hashtag_count FROM hashtags_hot;
  SELECT COUNT(*) INTO v_sound_count FROM sounds_hot;
  
  RAISE NOTICE '===== DATA CHECK =====';
  RAISE NOTICE 'Videos in videos_hot: %', v_video_count;
  RAISE NOTICE 'Creators in creators_hot: %', v_creator_count;
  RAISE NOTICE 'Hashtags in hashtags_hot: %', v_hashtag_count;
  RAISE NOTICE 'Sounds in sounds_hot: %', v_sound_count;
END $$;

-- Step 2: Check the specific creator
SELECT 
  creator_id,
  username,
  display_name,
  followers_count,
  videos_count,
  likes_total,
  total_play_count
FROM creators_hot
WHERE creator_id = '6822973263813133317';

-- Step 3: Check if hashtag exists
SELECT 
  hashtag,
  hashtag_norm,
  views_total,
  videos_count,
  creators_count
FROM hashtags_hot
WHERE hashtag = 'cartoon' OR hashtag = 'cartoons';

-- Step 4: Check video_hashtag_facts for 'cartoon'
SELECT 
  vhf.video_id,
  vhf.hashtag,
  vhf.views_at_snapshot,
  v.views_count,
  v.creator_id
FROM video_hashtag_facts vhf
JOIN videos_hot v ON v.video_id = vhf.video_id
WHERE vhf.hashtag LIKE '%cartoon%'
LIMIT 10;

-- Step 5: Manually run aggregations
RAISE NOTICE '===== RUNNING AGGREGATIONS =====';

-- Update creator aggregations
UPDATE creators_hot c
SET 
  videos_count = (
    SELECT COUNT(*) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  likes_total = (
    SELECT COALESCE(SUM(likes_count), 0) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  total_play_count = (
    SELECT COALESCE(SUM(views_count), 0)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  ),
  updated_at = NOW();

RAISE NOTICE 'Creator aggregations updated';

-- Update sound aggregations
UPDATE sounds_hot s
SET 
  videos_count = (
    SELECT COUNT(DISTINCT video_id) 
    FROM video_sound_facts vsf 
    WHERE vsf.sound_id = s.sound_id
  ),
  views_total = (
    SELECT COALESCE(SUM(v.views_count), 0)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  likes_total = (
    SELECT COALESCE(SUM(v.likes_count), 0)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ),
  updated_at = NOW();

RAISE NOTICE 'Sound aggregations updated';

-- Update hashtag aggregations
UPDATE hashtags_hot h
SET 
  videos_count = (
    SELECT COUNT(DISTINCT video_id) 
    FROM video_hashtag_facts vhf 
    WHERE vhf.hashtag = h.hashtag
  ),
  creators_count = (
    SELECT COUNT(DISTINCT v.creator_id)
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = h.hashtag
  ),
  views_total = (
    SELECT COALESCE(SUM(v.views_count), 0)
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = h.hashtag
  ),
  likes_total = (
    SELECT COALESCE(SUM(v.likes_count), 0)
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = h.hashtag
  ),
  updated_at = NOW();

RAISE NOTICE 'Hashtag aggregations updated';

-- Step 6: Verify the specific creator after aggregation
RAISE NOTICE '===== VERIFICATION =====';

SELECT 
  creator_id,
  username,
  display_name,
  followers_count,
  videos_count AS "videos (should be > 0)",
  likes_total AS "likes (should be > 0)",
  total_play_count AS "views (should be > 0)"
FROM creators_hot
WHERE creator_id = '6822973263813133317';

-- Step 7: Verify the hashtag after aggregation
SELECT 
  hashtag,
  hashtag_norm,
  views_total AS "views (should be > 0)",
  videos_count AS "videos (should be > 0)",
  creators_count AS "creators (should be > 0)"
FROM hashtags_hot
WHERE hashtag = 'cartoon' OR hashtag = 'cartoons';

-- Step 8: Check top creators by views
SELECT 
  username,
  display_name,
  total_play_count,
  videos_count,
  likes_total
FROM creators_hot
ORDER BY total_play_count DESC
LIMIT 10;

RAISE NOTICE '===== AGGREGATION COMPLETE =====';

