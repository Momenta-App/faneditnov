# Complete Rollback Checklist

## Summary
You're rolling back from commit `1d32835` which includes migrations 031-049 and code changes that use `video_hot_id` and `is_edit` features.

## ✅ Database Rollback (Required)

### Step 1: Run SQL Rollback Script
**File:** `sql/ROLLBACK_031_to_047.sql`

This script handles:
- ✅ Migration 031: Removes `video_hot_id` column from `contest_submissions`
- ✅ Migration 032: Removes bidirectional sync triggers and functions
- ✅ Migration 045: Removes backfill function
- ✅ Migration 046: Keeps `cover_url` column (it was added earlier)
- ✅ Migration 047: Restores dropped columns (if it ran)
- ✅ Migration 048: Removes `is_edit` index from `videos_hot`
- ✅ Migration 049: Backfill already ran, no rollback needed (data stays)

**Action:** Run this file in Supabase SQL Editor

---

### Step 2: Revert Ingestion Function
**File:** `sql/028_multi_platform_ingestion_REVERT.sql`

This reverts the ingestion function to the version before the checkpoint, removing:
- `is_edit` flag handling
- Updated `cover_url` extraction logic

**Action:** Run this file in Supabase SQL Editor

---

## ⚠️ Code Changes to Verify

The following files were modified in that commit and may reference the rolled-back features:

### Files That May Reference `video_hot_id`:
- `src/app/api/admin/contests/[id]/submissions/route.ts`
- `src/app/api/admin/contests/[id]/refresh-submissions/route.ts`
- `src/app/api/contests/[id]/submissions-public/route.ts`
- `src/app/api/contests/[id]/submissions/[submissionId]/verify-ingestion/route.ts`
- `src/app/api/brightdata/contest-webhook/route.ts`

### Files That May Reference `is_edit`:
- `src/app/api/contests/[id]/submissions-public/route.ts`
- `src/app/api/admin/contests/[id]/submissions/route.ts`
- `src/app/api/communities/[id]/videos/route.ts`
- `src/app/components/ContestSubmissionCard.tsx`

**Action:** Since you're at the checkpoint, your code should already be reverted. But verify these files don't reference:
- `video_hot_id` column
- `is_edit` column (unless it was added in an earlier migration)

---

## 🔍 Verification Steps

After running the SQL rollback, verify:

### 1. Database Structure
```sql
-- Check video_hot_id is gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contest_submissions' 
AND column_name = 'video_hot_id';
-- Should return 0 rows

-- Check original columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contest_submissions' 
AND column_name IN ('original_video_url', 'platform', 'video_id', 'views_count', 'likes_count', 'impact_score')
ORDER BY column_name;
-- Should return all 6 columns

-- Check triggers are gone
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'contest_submissions' 
AND trigger_name LIKE '%sync%';
-- Should return 0 rows
```

### 2. Code References
Search your codebase for:
```bash
# Check for video_hot_id references
grep -r "video_hot_id" src/

# Check for is_edit references (if you want to remove it completely)
grep -r "is_edit" src/
```

---

## 📝 Notes

1. **`is_edit` Column**: The rollback script removes the index but keeps the column. If `is_edit` was added in an earlier migration (before 048), it will remain. If you want to completely remove it, uncomment the line in the rollback script.

2. **`cover_url` Column**: This column may have been added in an earlier migration. The rollback script keeps it since it's useful even without the normalization.

3. **Data Loss**: If migration 047 ran and dropped columns, any data in those columns is lost. The rollback restores the structure but not the data.

4. **Code Compatibility**: Make sure your application code matches the database structure. If you're at the checkpoint commit, your code should already be compatible.

---

## ✅ Final Checklist

- [ ] Backup database created
- [ ] `sql/ROLLBACK_031_to_047.sql` executed successfully
- [ ] `sql/028_multi_platform_ingestion_REVERT.sql` executed successfully
- [ ] Database structure verified (queries above)
- [ ] Code checked for `video_hot_id` references
- [ ] Code checked for `is_edit` references (if removing)
- [ ] Application tested to ensure it works with rolled-back schema

---

## 🆘 If Something Goes Wrong

1. **Restore from backup** (if you created one)
2. **Check error messages** - the rollback script uses `IF EXISTS` checks, so errors are usually about constraints
3. **Manual cleanup** - You may need to drop foreign keys manually if they reference `video_hot_id`

