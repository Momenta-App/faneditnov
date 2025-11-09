-- Final verification: Check that all columns are populated correctly

-- 1. Check individual creators have correct data
SELECT 
  creator_id,
  username,
  display_name,
  videos_count,
  total_play_count,
  likes_total,
  followers_count,
  CASE 
    WHEN videos_count > 0 THEN ROUND(total_play_count::numeric / videos_count, 0)
    ELSE 0
  END as avg_views_per_video,
  CASE 
    WHEN total_play_count > 0 THEN ROUND((likes_total::numeric / total_play_count::numeric) * 100, 2)
    ELSE 0
  END as engagement_rate_pct
FROM creators_hot
ORDER BY total_play_count DESC;

-- 2. Verify the totals make sense
SELECT 
  'Creators' as metric, COUNT(*) as count
FROM creators_hot
UNION ALL
SELECT 
  'Videos in creators_hot', SUM(videos_count)
FROM creators_hot
UNION ALL
SELECT 
  'Actual videos in videos_hot', COUNT(*)
FROM videos_hot
UNION ALL
SELECT 
  'Total views in creators_hot', SUM(total_play_count)
FROM creators_hot
UNION ALL
SELECT 
  'Total views in videos_hot', SUM(views_count)
FROM videos_hot;

-- 3. Check cold tables (should populate on next ingestion)
SELECT 
  'creators_cold' as table_name, 
  COUNT(*) as record_count,
  (SELECT COUNT(*) FROM creators_hot) as expected_count
FROM creators_cold
UNION ALL
SELECT 
  'hashtags_cold', 
  COUNT(*),
  (SELECT COUNT(*) FROM hashtags_hot)
FROM hashtags_cold;

-- 4. Sample data quality check
SELECT 
  'Data quality check' as check_type,
  CASE 
    WHEN SUM(videos_count) = 0 THEN '❌ videos_count is zero'
    WHEN SUM(total_play_count) = 0 THEN '❌ total_play_count is zero'
    WHEN SUM(likes_total) = 0 THEN '⚠️  likes_total is zero (might be OK)'
    ELSE '✅ All columns populated'
  END as status
FROM creators_hot;

