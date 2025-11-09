-- Alternative initialization that handles edge cases
-- Run this if the first initialization didn't work

-- 1. Initialize creators_hot total_play_count (force update even if NULL)
UPDATE creators_hot c
SET 
  total_play_count = COALESCE((
    SELECT SUM(v.views_count)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  ), 0),
  updated_at = NOW();

-- 2. Initialize video_play_count_history from existing videos
INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
SELECT 
  v.video_id, 
  COALESCE(v.views_count, 0),
  NOW()
FROM videos_hot v
WHERE NOT EXISTS (
  SELECT 1 
  FROM video_play_count_history vph 
  WHERE vph.video_id = v.video_id
)
ON CONFLICT (video_id) DO NOTHING;

-- 3. Initialize sounds_hot views_total (force update)
UPDATE sounds_hot s
SET 
  views_total = COALESCE((
    SELECT SUM(v.views_count)
    FROM video_sound_facts vsf
    JOIN videos_hot v ON v.video_id = vsf.video_id
    WHERE vsf.sound_id = s.sound_id
  ), 0),
  updated_at = NOW();

-- 4. Initialize hashtags_hot views_total (force update)
UPDATE hashtags_hot h
SET 
  views_total = COALESCE((
    SELECT SUM(v.views_count)
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = h.hashtag
  ), 0),
  updated_at = NOW();

-- Now show the results
SELECT 'INITIALIZATION COMPLETE' as status;

