-- Initialize view counts for existing data
-- Run this after migration to populate initial values

-- 1. Initialize creators_hot total_play_count from existing videos
UPDATE creators_hot c
SET total_play_count = (
  SELECT COALESCE(SUM(views_count), 0)
  FROM videos_hot v
  WHERE v.creator_id = c.creator_id
);

-- 2. Initialize video_play_count_history for existing videos
INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
SELECT video_id, views_count, NOW()
FROM videos_hot
WHERE video_id NOT IN (SELECT video_id FROM video_play_count_history);

-- 3. Initialize sounds_hot views_total from existing videos
UPDATE sounds_hot s
SET views_total = (
  SELECT COALESCE(SUM(v.views_count), 0)
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE vsf.sound_id = s.sound_id
);

-- 4. Initialize hashtags_hot views_total from existing videos
UPDATE hashtags_hot h
SET views_total = (
  SELECT COALESCE(SUM(v.views_count), 0)
  FROM video_hashtag_facts vhf
  JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE vhf.hashtag = h.hashtag
);

-- Verify the updates
SELECT 
  'Creators initialized' as step,
  COUNT(*) as count,
  SUM(total_play_count) as total_views
FROM creators_hot
WHERE total_play_count > 0;

SELECT 
  'Video history records' as step,
  COUNT(*) as count
FROM video_play_count_history;

SELECT 
  'Sounds with views' as step,
  COUNT(*) as count,
  SUM(views_total) as total_views
FROM sounds_hot
WHERE views_total > 0;

SELECT 
  'Hashtags with views' as step,
  COUNT(*) as count,
  SUM(views_total) as total_views
FROM hashtags_hot
WHERE views_total > 0;

