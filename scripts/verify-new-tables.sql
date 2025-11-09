-- Verify that the new tables and columns exist
-- Run this to confirm your changes were applied successfully

-- 1. Check if creators_cold table exists
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'creators_cold'
ORDER BY ordinal_position;

-- 2. Check if hashtags_cold table exists
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'hashtags_cold'
ORDER BY ordinal_position;

-- 3. Check if total_play_count column exists in creators_hot
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'creators_hot' 
  AND column_name = 'total_play_count';

-- 4. Count records in each table
SELECT 
  'creators_hot' as table_name, 
  COUNT(*) as record_count
FROM creators_hot
UNION ALL
SELECT 
  'creators_cold', 
  COUNT(*)
FROM creators_cold
UNION ALL
SELECT 
  'hashtags_hot', 
  COUNT(*)
FROM hashtags_hot
UNION ALL
SELECT 
  'hashtags_cold', 
  COUNT(*)
FROM hashtags_cold;

-- 5. Sample data from creators_hot showing total_play_count
SELECT 
  creator_id,
  username,
  videos_count,
  total_play_count,
  likes_total,
  CASE 
    WHEN total_play_count > 0 THEN ROUND((likes_total::numeric / total_play_count::numeric) * 100, 2)
    ELSE 0
  END as engagement_rate
FROM creators_hot
WHERE videos_count > 0
ORDER BY total_play_count DESC
LIMIT 10;

