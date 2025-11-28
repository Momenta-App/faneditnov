# Database Rollback Instructions

## Overview
This guide will help you rollback your database to the state before commit `1d32835` (the checkpoint you mentioned).

## What Changed in That Commit
- Modified `028_multi_platform_ingestion.sql` (added `is_edit` flag and `cover_url` handling)
- Added migration `031_contest_submissions_video_hot_link.sql`
- Added migration `032_bidirectional_video_stats_sync.sql`
- Added migration `045_backfill_video_hot_ids.sql`
- Added migration `046_add_cover_url_to_contest_submissions.sql`
- Added migration `047_normalize_contest_submissions_to_videos_hot.sql`
- Added migration `048_add_is_edit_index.sql` (adds index on `is_edit` column)
- Added migration `049_backfill_is_edit_flag.sql` (backfills `is_edit` values)

## ⚠️ IMPORTANT: Backup First!

**Before proceeding, create a backup of your database:**
1. Go to Supabase Dashboard → Settings → Database
2. Click "Backups" → "Create backup" (or use point-in-time recovery if available)

## Step-by-Step Rollback Process

### Step 1: Rollback Migrations 031-047

**File to run:** `sql/ROLLBACK_031_to_047.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy the **entire contents** of `sql/ROLLBACK_031_to_047.sql`
3. Paste into SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

This will:
- Remove triggers and sync functions from migration 032
- Remove the `video_hot_id` column from `contest_submissions`
- Restore columns that were dropped (if migration 047 ran)
- Restore indexes
- Remove the `is_edit` index from `videos_hot` (migration 048)

**Expected result:** The `contest_submissions` table structure is restored to its original state.

---

### Step 2: Revert Ingestion Function (Optional but Recommended)

**File to run:** The previous version of `028_multi_platform_ingestion.sql`

Since the ingestion function was modified in that commit, you should revert it to the previous version:

1. Open Supabase Dashboard → SQL Editor
2. Run this command to get the previous version:

```bash
# In your terminal, run:
git show 1d32835^:sql/028_multi_platform_ingestion.sql > /tmp/028_revert.sql
```

3. Copy the contents of `/tmp/028_revert.sql`
4. Paste into Supabase SQL Editor
5. Click "Run"

**OR** manually revert by running the previous version from git:

```sql
-- Copy the entire function from the previous commit
-- This will replace the current function with the version before the checkpoint
```

---

## Verification Queries

After running the rollback, verify everything worked:

### 1. Check that `video_hot_id` column is gone:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contest_submissions' 
AND column_name = 'video_hot_id';
-- Should return 0 rows
```

### 2. Check that original columns are restored:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'contest_submissions' 
AND column_name IN (
  'original_video_url', 
  'platform', 
  'video_id', 
  'views_count', 
  'likes_count', 
  'impact_score'
)
ORDER BY column_name;
-- Should show all these columns exist
```

### 3. Check that triggers are gone:
```sql
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'contest_submissions' 
AND trigger_name LIKE '%sync%';
-- Should return 0 rows
```

### 4. Check that sync functions are gone:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'sync_contest_submission_stats', 
  'sync_video_hot_stats', 
  'backfill_submission_video_hot_id'
);
-- Should return 0 rows
```

---

## Summary: What to Run and When

### Order of Operations:

1. **First:** Run `sql/ROLLBACK_031_to_047.sql` in Supabase SQL Editor
   - This handles all the structural changes

2. **Second:** Revert `028_multi_platform_ingestion.sql` to previous version
   - Get previous version: `git show 1d32835^:sql/028_multi_platform_ingestion.sql`
   - Run that SQL in Supabase SQL Editor

3. **Third:** Run verification queries above to confirm everything worked

---

## Troubleshooting

### If you get foreign key constraint errors:
The rollback script uses `IF EXISTS` checks, so it should be safe. If you encounter errors:
- Check which specific constraint is failing
- You may need to drop dependent objects first

### If columns don't restore:
- Check if migration 047 actually ran (it may not have)
- The script will restore columns only if they're missing
- If data was lost when columns were dropped, it cannot be recovered

### If you need to restore data:
- Use your database backup if you created one
- Or restore from Supabase point-in-time recovery (if enabled)

---

## Quick Reference

**Files to run (in order):**
1. `sql/ROLLBACK_031_to_047.sql` ← Run this first
2. Previous version of `028_multi_platform_ingestion.sql` ← Run this second

**Where to run:**
- Supabase Dashboard → SQL Editor

**Time estimate:**
- Step 1: ~30 seconds
- Step 2: ~10 seconds
- Verification: ~1 minute

