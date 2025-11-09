-- Step 1: Check what data you have
-- This tells us if you have creators, videos, sounds, etc.

-- Check creators
SELECT 'CREATORS' as type, COUNT(*) as total_count FROM creators_hot;
SELECT 'Creators with videos' as info, COUNT(DISTINCT creator_id) as count FROM videos_hot;

-- Check videos  
SELECT 'VIDEOS' as type, COUNT(*) as total_count FROM videos_hot;
SELECT 'Videos with views > 0' as info, COUNT(*) as count FROM videos_hot WHERE views_count > 0;

-- Check sounds
SELECT 'SOUNDS' as type, COUNT(*) as total_count FROM sounds_hot;
SELECT 'Sounds linked to videos' as info, COUNT(DISTINCT sound_id) as count FROM video_sound_facts;

-- Check hashtags
SELECT 'HASHTAGS' as type, COUNT(*) as total_count FROM hashtags_hot;
SELECT 'Hashtags with views' as info, COUNT(*) as count FROM hashtags_hot WHERE views_total > 0;

-- Check if history table has data
SELECT 'HISTORY RECORDS' as type, COUNT(*) as total_count FROM video_play_count_history;

