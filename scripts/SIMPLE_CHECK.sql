-- Simple check of your data

-- 1. How many creators do you have?
SELECT COUNT(*) as creator_count FROM creators_hot;

-- 2. How many videos do you have?
SELECT COUNT(*) as video_count FROM videos_hot;

-- 3. How many sounds do you have?
SELECT COUNT(*) as sound_count FROM sounds_hot;

-- 4. Do your creators have the total_play_count column?
SELECT creator_id, username, total_play_count FROM creators_hot LIMIT 5;

-- 5. Do your videos have view counts?
SELECT video_id, views_count FROM videos_hot LIMIT 5;

