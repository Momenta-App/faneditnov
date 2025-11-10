# Quick Start: Database Setup Guide

Complete step-by-step guide to set up your fresh database.

## Prerequisites Checklist

- [ ] Supabase project created
- [ ] `.env.local` file with all environment variables
- [ ] Access to Supabase Dashboard

## Step 1: Verify Environment Variables

Check your `.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID=your-scraper-id
BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID=your-youtube-scraper-id  # Optional
```

## Step 2: Run SQL Migrations

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run each file **in this exact order**:

#### Core Tables (Run First)
```sql
-- Copy and paste each file's contents, then click "Run"
```

**Files to run in order:**

1. `sql/006_hot_tables.sql` - Core hot tables
2. `sql/007_cold_tables.sql` - Cold storage tables  
3. `sql/010_fact_tables.sql` - Relationship tables
4. `sql/009_timeseries.sql` - Time series tables
5. `sql/008_leaderboards.sql` - Leaderboard views

#### Authentication
6. `sql/018_profiles_and_auth.sql` - User profiles
7. `sql/031_fix_profile_trigger_error_handling.sql` - Profile fixes

#### Video Processing
8. `sql/014_rejected_videos.sql` - Rejected videos table
9. `sql/023_rejected_videos_enhancement.sql` - Enhanced rejected videos
10. `sql/024_submission_metadata.sql` - Submission tracking

#### Ingestion Function (Choose ONE)
11. **`sql/023_admin_bypass_validation.sql`** - Standard ingestion
   
   **OR** (for multi-platform support):
   
   **`sql/028_multi_platform_ingestion.sql`** - Instagram + YouTube support
   
   ⚠️ **Important:** Only run ONE of these. The multi-platform version is recommended.

#### Aggregations & Stats
12. `sql/013_add_play_counts.sql` - Play count tracking
13. `sql/012_aggregation.sql` - Aggregation functions
14. `sql/015_add_missing_tables_columns.sql` - Additional columns
15. `sql/019_impact_score.sql` - Impact scores

#### Daily Aggregations (Optional)
16. `sql/020_daily_aggregation_tables.sql` - Daily stats tables
17. `sql/021_daily_aggregation_functions.sql` - Daily functions
18. `sql/022_backfill_daily_stats.sql` - Backfill function

#### Communities (Optional)
19. `sql/017_communities.sql` - Communities feature
20. `sql/024_community_membership_edit_flag.sql` - Membership flags
21. `sql/025_community_rejected_video_functions.sql` - Community functions

#### Additional Features
22. `sql/016_sound_functions.sql` - Sound functions
23. `sql/027_homepage_cache.sql` - Homepage cache
24. `sql/028_creator_contacts.sql` - Creator contacts
25. `sql/029_brand_contact_rate_limiting.sql` - Rate limiting
26. `sql/030_auth_rate_limiting.sql` - Auth rate limiting
27. `sql/025_fix_aggregation_error_handling.sql` - Error handling

### Option B: Using Script (Alternative)

```bash
# Run individual migrations
npx tsx scripts/run-sql.ts sql/006_hot_tables.sql
npx tsx scripts/run-sql.ts sql/007_cold_tables.sql
# ... continue for each file
```

**Note:** The script may not work for all SQL files (especially functions with complex syntax). Using Supabase SQL Editor is more reliable.

## Step 3: Set Up Image Storage

### 3.1 Create Storage Bucket

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. **Bucket name:** `brightdata-results`
4. **Public bucket:** Toggle **ON** (make it public)
5. Click **"Create bucket"**

### 3.2 Set Up Storage Policies

After creating the bucket, run:

```bash
npx tsx scripts/run-sql.ts sql/026_image_storage_setup.sql
```

**OR** manually in Supabase SQL Editor:
- Copy contents of `sql/026_image_storage_setup.sql`
- Paste and run in SQL Editor

## Step 4: Verify Setup

Run these verification queries in Supabase SQL Editor:

### Check Core Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'videos_hot', 'creators_hot', 'sounds_hot', 'hashtags_hot',
    'videos_cold', 'profiles', 'rejected_videos', 
    'submission_metadata', 'bd_ingestions'
  )
ORDER BY table_name;
```

Should return 9+ tables.

### Check Ingestion Function
```sql
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'ingest_brightdata_snapshot_v2';
```

Should return 1 row.

### Check Storage Bucket
```sql
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'brightdata-results';
```

Should return: `brightdata-results | brightdata-results | true`

### Check Storage Policies
```sql
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%brightdata%';
```

Should return at least 3 policies.

## Step 5: Create Admin User

1. **Sign up** through your app: Go to `/auth/signup` and create an account
2. **Get your user ID:**
   - Go to Supabase Dashboard → Authentication → Users
   - Find your email and copy the User UID
3. **Make yourself admin:**

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

**OR** by user ID:

```sql
-- Replace 'user-uuid-here' with your User UID from auth.users
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'user-uuid-here';
```

## Step 6: Test the Setup

### Test 1: Check API Status

Visit: `http://localhost:3000/api/brightdata/trigger`

Should return:
```json
{
  "message": "BrightData Trigger API",
  "supportedPlatforms": ["instagram", "youtube"],
  "configuration": {
    "instagram": true,
    "youtube": true/false
  }
}
```

### Test 2: Test Diagnostic Endpoint

Visit: `http://localhost:3000/api/diagnostic/bulk-upload`

Should show:
- ✅ Authenticated: true
- ✅ Environment variables configured
- ✅ Platform configuration

### Test 3: Test Image Storage

```sql
-- Check bucket is accessible
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'brightdata-results';
```

### Test 4: Test Ingestion (Optional)

```sql
-- Test with mock Instagram data
SELECT ingest_brightdata_snapshot_v2(
  'test_123',
  'test',
  '[{
    "url": "https://www.instagram.com/p/ABC123",
    "post_id": "ABC123",
    "user_posted": "test_user",
    "description": "Test #edit",
    "hashtags": ["edit"],
    "views": 1000,
    "likes": 50,
    "num_comments": 10,
    "date_posted": "2024-01-01T00:00:00Z"
  }]'::jsonb,
  false
);
```

Should return success JSON.

## Step 7: Initialize Homepage Cache (Optional)

After all migrations:

```sql
SELECT refresh_homepage_cache(NULL);
```

This populates the homepage cache with initial data.

## Troubleshooting

### "Table already exists"
- Safe to ignore if using `CREATE TABLE IF NOT EXISTS`
- If error persists, check if table exists: `SELECT * FROM table_name LIMIT 1;`

### "Function already exists"
- Most functions use `CREATE OR REPLACE FUNCTION` - safe to re-run
- If issues, drop first: `DROP FUNCTION IF EXISTS function_name(...);`

### "Bucket does not exist"
- Make sure you created the bucket in Supabase Dashboard first
- Check bucket name is exactly: `brightdata-results`

### "Permission denied" on storage
- Make sure bucket is set to PUBLIC
- Run `sql/026_image_storage_setup.sql` after creating bucket

### Ingestion function errors
- Make sure you only ran ONE ingestion function migration
- Check function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'ingest_brightdata_snapshot_v2';`

## Next Steps

After setup is complete:

1. ✅ Test uploading an Instagram URL
2. ✅ Test uploading a YouTube Shorts URL  
3. ✅ Verify webhook receives data
4. ✅ Check images are stored in Supabase Storage
5. ✅ Verify data appears in database tables

## Quick Reference

**Storage Bucket:** `brightdata-results` (must be PUBLIC)

**Key Tables:**
- `videos_hot` - Video data
- `creators_hot` - Creator profiles
- `profiles` - User accounts
- `rejected_videos` - Rejected videos
- `submission_metadata` - Upload tracking

**Key Function:**
- `ingest_brightdata_snapshot_v2()` - Processes webhook data

