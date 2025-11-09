# Database Missing Tables and Columns - Fixed

## Summary

You were correct - several tables and columns were missing from your database schema.

## Issues Found

### 1. Missing Tables ✅ FIXED

#### `creators_cold` 
- **Status:** Missing entirely
- **What it should store:** Cold storage for complete creator profile JSON data
- **Added in:** `sql/015_add_missing_tables_columns.sql`

#### `hashtags_cold`
- **Status:** Missing entirely  
- **What it should store:** Cold storage for hashtag metadata, trending history, and analytics
- **Added in:** `sql/015_add_missing_tables_columns.sql`

**Note:** You already have `creator_profiles_cold` (singular), which is similar to `creators_cold` but has a slightly different structure.

### 2. Missing Columns ✅ FIXED

#### `total_play_count` in `creators_hot`
- **Status:** Missing but referenced by aggregation functions
- **Purpose:** Tracks total views across all creator videos
- **Issue:** The `update_aggregations()` function in `sql/012_aggregation.sql` (line 34) was trying to update this column, but it didn't exist!
- **Added in:** `sql/015_add_missing_tables_columns.sql`

### 3. Column Name Clarification

You mentioned `total_videos_count` is missing. Actually:
- ✅ `creators_hot` has `videos_count` (line 19 of `006_hot_tables.sql`)
- ✅ `hashtags_hot` has `videos_count` (line 160 of `006_hot_tables.sql`)  
- ✅ `sounds_hot` has `videos_count` (line 123 of `006_hot_tables.sql`)

These tables use `videos_count` not `total_videos_count`. Both are semantically the same.

## Changes Made

### File: `sql/015_add_missing_tables_columns.sql` (NEW)

This migration adds:

1. **Column Added to `creators_hot`:**
   ```sql
   ALTER TABLE creators_hot 
   ADD COLUMN IF NOT EXISTS total_play_count BIGINT DEFAULT 0;
   ```

2. **New Table: `creators_cold`**
   - Complete creator JSON storage
   - Platform identities tracking
   - Insights and engagement metrics
   - Full RLS policies

3. **New Table: `hashtags_cold`**
   - Hashtag metadata storage
   - Related hashtags tracking
   - Trending history
   - Usage statistics

### File: `sql/012_aggregation.sql` (UPDATED)

Fixed the `update_aggregation_quick()` function to also update `total_play_count`:
```sql
UPDATE creators_hot c
SET 
  videos_count = (SELECT COUNT(*) FROM videos_hot v WHERE v.creator_id = c.creator_id),
  likes_total = (SELECT COALESCE(SUM(likes_count), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),
  total_play_count = (SELECT COALESCE(SUM(views_count), 0) FROM videos_hot v WHERE v.creator_id = c.creator_id),  -- ADDED
  updated_at = NOW();
```

### File: `sql/011_ingestion_v2.sql` (UPDATED)

Updated the ingestion function to populate the new cold tables:

1. **Populate `creators_cold`:**
   ```sql
   INSERT INTO creators_cold (creator_id, full_json, raw_data)
   VALUES (v_creator_id, COALESCE(v_element->'author', v_element->'profile', '{}'::JSONB), v_element)
   ON CONFLICT (creator_id) DO UPDATE SET
     full_json = EXCLUDED.full_json,
     raw_data = EXCLUDED.raw_data,
     updated_at = NOW();
   ```

2. **Populate `hashtags_cold`:**
   ```sql
   INSERT INTO hashtags_cold (hashtag, raw_data)
   VALUES (v_hashtag, v_element)
   ON CONFLICT (hashtag) DO UPDATE SET
     updated_at = NOW();
   ```

3. **Auto-update aggregations** (NEW):
   - After processing all videos, the function now calls `update_aggregations()`
   - This automatically updates `videos_count`, `likes_total`, and `total_play_count` in `creators_hot`
   - Also updates counts for `hashtags_hot` and `sounds_hot`
   - Ensures accurate counts are always maintained after each ingestion

## How to Apply

Run the migration:
```bash
# Using psql or your connection tool
psql -d your_database -f sql/015_add_missing_tables_columns.sql
```

Or using the project's SQL runner:
```bash
cd scripts
ts-node run-sql.ts ../sql/015_add_missing_tables_columns.sql
```

## Column Reference

Here's what each count column does:

| Table | Column | Purpose |
|-------|--------|---------|
| `creators_hot` | `videos_count` | Number of videos by this creator |
| `creators_hot` | `total_play_count` | Total views across all creator's videos |
| `creators_hot` | `likes_total` | Total likes across all creator's videos |
| `hashtags_hot` | `videos_count` | Number of videos using this hashtag |
| `hashtags_hot` | `views_total` | Total views of videos with this hashtag |
| `hashtags_hot` | `creators_count` | Number of creators using this hashtag |
| `sounds_hot` | `videos_count` | Number of videos using this sound |
| `sounds_hot` | `views_total` | Total views of videos using this sound |

## Testing

After applying the migration:

1. **Verify tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name IN ('creators_cold', 'hashtags_cold');
   ```

2. **Verify column exists:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'creators_hot' AND column_name = 'total_play_count';
   ```

3. **Test aggregation function:**
   ```sql
   SELECT update_aggregations();
   ```

4. **Check data:**
   ```sql
   SELECT creator_id, username, videos_count, total_play_count, likes_total 
   FROM creators_hot 
   LIMIT 5;
   ```

## Related Files

- `sql/006_hot_tables.sql` - Hot table definitions
- `sql/007_cold_tables.sql` - Existing cold tables  
- `sql/012_aggregation.sql` - Aggregation functions (updated)
- `sql/011_ingestion_v2.sql` - Ingestion function (updated to populate new cold tables)
- `sql/015_add_missing_tables_columns.sql` - **NEW** Migration file to add missing tables/columns

