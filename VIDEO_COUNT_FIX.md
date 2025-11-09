# Fix for Video Count Issue

## Problem
After uploading multiple videos for the same creator, the `videos_count` in `creators_hot` was still showing as 1, even though all videos were visible on the creator page.

## Root Cause
The ingestion function `ingest_brightdata_snapshot_v2` was not automatically updating the aggregate counts (`videos_count`, `likes_total`, `total_play_count`) after processing videos.

## Solution

### Step 1: Update the Ingestion Function in Supabase
Run this in Supabase SQL Editor to apply the updated ingestion function:

The function in `sql/011_ingestion_v2.sql` has been updated to automatically call `update_aggregations()` at the end. The key change is around line 405:

```sql
-- At the end of ingest_brightdata_snapshot_v2, after processing all videos:
RAISE NOTICE 'Updating aggregations...';
PERFORM update_aggregations();
RAISE NOTICE 'Aggregation update complete';
```

**To apply:** Copy the entire updated function from `sql/011_ingestion_v2.sql` and run it in Supabase SQL Editor.

### Step 2: Fix Existing Data (Run Immediately)
Run this in Supabase SQL Editor to fix the current incorrect counts:

```sql
-- Fix video counts for all existing creators
UPDATE creators_hot c
SET 
  videos_count = (
    SELECT COUNT(*)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
);
```

Or simply run: `scripts/fix-video-counts-now.sql`

### Step 3: Verify the Fix
```sql
-- Verify creators now have correct counts
SELECT 
  creator_id,
  username,
  videos_count,
  total_play_count,
  (SELECT COUNT(*) FROM videos_hot WHERE creator_id = creators_hot.creator_id) as actual_video_count
FROM creators_hot
ORDER BY videos_count DESC;
```

All rows should show `videos_count = actual_video_count`.

## How It Works Now

1. **Upload videos** → BrightData webhook triggers ingestion
2. **Ingestion processes videos** → Stores in hot/cold tables
3. **Auto-update counts** → `update_aggregations()` runs automatically
4. **Display updated** → Creator pages show correct video counts

## Files Changed

- ✅ `sql/011_ingestion_v2.sql` - Added auto-aggregation call
- ✅ `sql/012_aggregation.sql` - Already had the aggregation function
- ✅ `src/app/api/creators/route.ts` - Already maps `videos_count` correctly
- ✅ `src/app/components/CreatorCard.tsx` - Already displays `creator.videos`

## What Gets Updated Automatically

The `update_aggregations()` function updates:
- `creators_hot.videos_count` - Count of videos per creator
- `creators_hot.total_play_count` - Sum of all video views
- `creators_hot.likes_total` - Sum of all video likes
- `hashtags_hot.videos_count` - Count of videos with each hashtag
- `hashtags_hot.views_total` - Sum of views with each hashtag
- `sounds_hot.videos_count` - Count of videos using each sound
- And more...

## Testing

After applying the fix:
1. Upload new videos for an existing creator
2. Check `/creators` page - video count should be correct
3. Check `/creator/[id]` page - video count should be correct
4. Verify the count matches actual number of videos displayed

## Summary

**Before:** Video counts had to be manually updated
**After:** Video counts update automatically after each ingestion

This ensures data accuracy in real-time without manual intervention.

