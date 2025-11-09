# View Count Implementation - Deployment Notes

## Status: ✅ SQL Migrations Complete

All 3 SQL migration files have been successfully run:
- ✅ `sql/013_add_play_counts.sql` - Schema changes
- ✅ `sql/011_ingestion_v2.sql` - Updated ingestion function
- ✅ `sql/012_aggregation.sql` - Updated aggregation function

## Next Steps

### 1. Initialize Existing Data
Run the initialization script to populate view counts for existing records:
```bash
psql $DATABASE_URL -f scripts/initialize-view-counts.sql
```

This will:
- Backfill `total_play_count` for all creators
- Create history records for existing videos
- Initialize view totals for sounds and hashtags

### 2. Deploy Frontend & Backend
Deploy the updated API routes and frontend code:
- All API routes now order by view counts
- Frontend sorts by "Most Views" by default
- Type definitions updated to include view counts

### 3. Test the Implementation
Test with real webhook data:
```bash
# Trigger a webhook manually
curl -X POST http://localhost:3000/api/manual-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "test_video_123",
    "profile_id": "test_creator_123",
    "play_count": 10000,
    "description": "Test video"
  }'
```

Then verify the delta calculation:
```sql
SELECT video_id, previous_play_count 
FROM video_play_count_history 
WHERE video_id = 'test_video_123';
```

### 4. Monitor
- Check webhook logs for successful delta calculations
- Verify leaderboards display correct view counts
- Run aggregation function periodically for safety:
  ```sql
  SELECT update_aggregations();
  ```

## Verification Queries

```sql
-- Check creators with view counts
SELECT creator_id, username, total_play_count, videos_count
FROM creators_hot
ORDER BY total_play_count DESC
LIMIT 10;

-- Check video history records
SELECT COUNT(*) as total_records
FROM video_play_count_history;

-- Verify data integrity
SELECT 
  c.creator_id,
  c.total_play_count as creator_total,
  COALESCE(SUM(v.views_count), 0) as sum_of_videos
FROM creators_hot c
LEFT JOIN videos_hot v ON v.creator_id = c.creator_id
GROUP BY c.creator_id, c.total_play_count
HAVING c.total_play_count != COALESCE(SUM(v.views_count), 0)
LIMIT 10;
-- Should return 0 rows if data is consistent
```

## Rollback Plan

If issues occur:
1. The old ingestion logic can be restored from git history
2. Run `SELECT update_aggregations();` to recalculate all totals
3. Old ordering can be restored in API routes

## Performance Notes

- All necessary indexes are in place
- Leaderboard queries should be fast with DESC indexes
- Consider running aggregation function daily as a safety net
- Monitor `video_play_count_history` table size over time

