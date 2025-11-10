# Setting Up a New Database - Step by Step

This guide walks you through setting up a completely fresh database for your Instagram/YouTube Shorts project.

## Prerequisites

✅ Supabase project created  
✅ Environment variables in `.env.local`  
✅ Access to Supabase Dashboard

## Step 1: Verify Environment Variables

Your `.env.local` should have:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Bright Data
BRIGHT_DATA_API_KEY=your-api-key
BRIGHT_DATA_CUSTOMER_ID=your-customer-id
BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID=your-instagram-scraper-id
BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID=your-youtube-scraper-id  # Optional
BRIGHT_DATA_WEBHOOK_SECRET=your-webhook-secret

# Storage
SUPABASE_STORAGE_BUCKET=brightdata-results

# App URL
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

## Step 2: Run SQL Migrations

**Best Method: Use Supabase SQL Editor**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. For each file below, copy the entire contents and paste into SQL Editor
3. Click **"Run"** (or press Cmd/Ctrl + Enter)
4. Wait for success message
5. Move to next file

### Migration Order (Run in This Exact Order)

#### Phase 1: Core Schema
1. ✅ `sql/006_hot_tables.sql` - Core tables (videos, creators, sounds, hashtags)
2. ✅ `sql/007_cold_tables.sql` - Cold storage tables
3. ✅ `sql/010_fact_tables.sql` - Relationship tables
4. ✅ `sql/009_timeseries.sql` - Time series tracking
5. ✅ `sql/008_leaderboards.sql` - Leaderboard views

#### Phase 2: Communities (MUST RUN BEFORE AUTH) ⚠️
6. ✅ `sql/017_communities.sql` - Communities feature (required before auth)

#### Phase 3: Authentication
7. ✅ `sql/018_profiles_and_auth.sql` - User profiles and auth (depends on communities)
8. ✅ `sql/031_fix_profile_trigger_error_handling.sql` - Profile trigger fixes

#### Phase 4: Video Processing
9. ✅ `sql/014_rejected_videos.sql` - Rejected videos table
10. ✅ `sql/023_rejected_videos_enhancement.sql` - Enhanced rejected videos
11. ✅ `sql/024_submission_metadata.sql` - Submission tracking

#### Phase 5: Ingestion Function ⚠️ IMPORTANT
12. **Choose ONE:**
   - ✅ `sql/023_admin_bypass_validation.sql` - Standard version
   - ✅ `sql/028_multi_platform_ingestion.sql` - **Recommended** (supports Instagram + YouTube)
   
   **Only run ONE of these!** The multi-platform version is recommended.

#### Phase 6: Aggregations
13. ✅ `sql/013_add_play_counts.sql` - Play count tracking
14. ✅ `sql/012_aggregation.sql` - Aggregation functions
15. ✅ `sql/015_add_missing_tables_columns.sql` - Additional columns
16. ✅ `sql/019_impact_score.sql` - Impact score calculations

#### Phase 7: Daily Aggregations (Optional)
17. ✅ `sql/020_daily_aggregation_tables.sql` - Daily stats tables
18. ✅ `sql/021_daily_aggregation_functions.sql` - Daily functions
19. ✅ `sql/022_backfill_daily_stats.sql` - Backfill function

#### Phase 8: Community Enhancements (Optional)
20. ✅ `sql/024_community_membership_edit_flag.sql` - Membership flags
21. ✅ `sql/025_community_rejected_video_functions.sql` - Community functions

#### Phase 9: Additional Features
22. ✅ `sql/016_sound_functions.sql` - Sound functions
23. ✅ `sql/027_homepage_cache.sql` - Homepage cache
24. ✅ `sql/028_creator_contacts.sql` - Creator contacts
25. ✅ `sql/029_brand_contact_rate_limiting.sql` - Rate limiting
26. ✅ `sql/030_auth_rate_limiting.sql` - Auth rate limiting
27. ✅ `sql/025_fix_aggregation_error_handling.sql` - Error handling

**Total: 27 migration files**

## Step 3: Set Up Image Storage

### 3.1 Create Storage Bucket (Manual Step)

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"** button
3. **Bucket name:** `brightdata-results`
4. **Public bucket:** Toggle **ON** ⚠️ (Important: must be public)
5. Click **"Create bucket"**

### 3.2 Set Up Storage Policies (SQL)

After creating the bucket, run:

28. ✅ `sql/026_image_storage_setup.sql` - Storage policies

**In Supabase SQL Editor:**
- Copy contents of `sql/026_image_storage_setup.sql`
- Paste and run

This sets up:
- Public read access
- Authenticated upload access
- Service role full access

## Step 4: Verify Everything Works

### Quick Verification

Run this in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT 
  'Tables' as type,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'videos_hot', 'creators_hot', 'sounds_hot', 'hashtags_hot',
    'videos_cold', 'profiles', 'rejected_videos', 
    'submission_metadata', 'bd_ingestions'
  )

UNION ALL

-- Check function exists
SELECT 
  'Functions' as type,
  COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'ingest_brightdata_snapshot_v2'

UNION ALL

-- Check storage bucket
SELECT 
  'Storage Buckets' as type,
  COUNT(*) as count
FROM storage.buckets 
WHERE id = 'brightdata-results';
```

**Expected Results:**
- Tables: 9
- Functions: 1
- Storage Buckets: 1

### Detailed Verification

Or use the verification script:

```bash
npx tsx scripts/verify-database-setup.ts
```

## Step 5: Create Your Admin Account

1. **Sign up** through your app at `/auth/signup`
2. **Get your email** from the signup
3. **Make yourself admin:**

```sql
-- Replace with your actual email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

## Step 6: Test the Setup

### Test 1: API Status
Visit: `http://localhost:3000/api/brightdata/trigger`

Should show supported platforms and configuration.

### Test 2: Diagnostic
Visit: `http://localhost:3000/api/diagnostic/bulk-upload`

Should show all green checkmarks.

### Test 3: Upload Test
Try uploading an Instagram URL through the UI and verify it works.

## Common Issues & Solutions

### Issue: "Table already exists"
- **Solution:** Safe to ignore if using `CREATE TABLE IF NOT EXISTS`
- If error persists, the table exists - continue to next migration

### Issue: "Function already exists"  
- **Solution:** Most functions use `CREATE OR REPLACE` - safe to re-run
- If error persists, drop function first: `DROP FUNCTION IF EXISTS function_name(...);`

### Issue: "Bucket does not exist"
- **Solution:** Create bucket in Supabase Dashboard → Storage first
- Then run `sql/026_image_storage_setup.sql`

### Issue: "Permission denied" on storage
- **Solution:** Make sure bucket is set to **PUBLIC** in Dashboard
- Re-run `sql/026_image_storage_setup.sql`

### Issue: Ingestion function errors
- **Solution:** Make sure you only ran ONE ingestion function migration
- Check which one: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'ingest_brightdata_snapshot_v2';`

## Migration Checklist

Use this to track your progress:

```
Phase 1: Core Schema
[ ] 006_hot_tables.sql
[ ] 007_cold_tables.sql
[ ] 010_fact_tables.sql
[ ] 009_timeseries.sql
[ ] 008_leaderboards.sql

Phase 2: Authentication
[ ] 018_profiles_and_auth.sql
[ ] 031_fix_profile_trigger_error_handling.sql

Phase 3: Video Processing
[ ] 014_rejected_videos.sql
[ ] 023_rejected_videos_enhancement.sql
[ ] 024_submission_metadata.sql

Phase 4: Ingestion
[ ] 023_admin_bypass_validation.sql OR 028_multi_platform_ingestion.sql

Phase 5: Aggregations
[ ] 013_add_play_counts.sql
[ ] 012_aggregation.sql
[ ] 015_add_missing_tables_columns.sql
[ ] 019_impact_score.sql

Phase 6: Daily Aggregations (Optional)
[ ] 020_daily_aggregation_tables.sql
[ ] 021_daily_aggregation_functions.sql
[ ] 022_backfill_daily_stats.sql

Phase 7: Communities (Optional)
[ ] 017_communities.sql
[ ] 024_community_membership_edit_flag.sql
[ ] 025_community_rejected_video_functions.sql

Phase 8: Additional Features
[ ] 016_sound_functions.sql
[ ] 027_homepage_cache.sql
[ ] 028_creator_contacts.sql
[ ] 029_brand_contact_rate_limiting.sql
[ ] 030_auth_rate_limiting.sql
[ ] 025_fix_aggregation_error_handling.sql

Storage Setup
[ ] Create bucket in Dashboard
[ ] 026_image_storage_setup.sql
```

## Time Estimate

- **Core migrations (Phases 1-5):** ~15-20 minutes
- **Optional features (Phases 6-8):** ~10-15 minutes
- **Storage setup:** ~2 minutes
- **Testing:** ~5 minutes

**Total: ~30-45 minutes**

## Next Steps After Setup

1. ✅ Create admin user profile
2. ✅ Test Instagram URL upload
3. ✅ Test YouTube Shorts URL upload
4. ✅ Verify webhook receives data
5. ✅ Check images are stored correctly
6. ✅ Verify data appears in database

## Need Help?

If you encounter errors:
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check the error message - most are self-explanatory
3. Verify you ran migrations in order
4. Make sure storage bucket is created and public

