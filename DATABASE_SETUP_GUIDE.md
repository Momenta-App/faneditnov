# Complete Database Setup Guide

This guide walks you through setting up a fresh database for the multi-platform Instagram/YouTube Shorts project.

## Prerequisites

- ✅ Supabase project created
- ✅ Environment variables configured (`.env.local`)
- ✅ Bright Data API keys set up

## Step 1: Environment Variables

Make sure your `.env.local` has:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Bright Data
BRIGHT_DATA_API_KEY=your-api-key
BRIGHT_DATA_CUSTOMER_ID=your-customer-id
BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID=your-instagram-scraper-id
BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID=your-youtube-scraper-id  # Optional
BRIGHT_DATA_WEBHOOK_SECRET=your-webhook-secret
BRIGHT_DATA_MOCK_MODE=false

# Storage
SUPABASE_STORAGE_BUCKET=brightdata-results

# App
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

## Step 2: Run SQL Migrations in Order

Run these SQL files **in this exact order** using Supabase SQL Editor or the `run-sql.ts` script:

### Core Schema (Foundation)

1. **`sql/006_hot_tables.sql`** - Core hot tables (videos, creators, sounds, hashtags)
2. **`sql/007_cold_tables.sql`** - Cold storage tables (full JSON)
3. **`sql/010_fact_tables.sql`** - Relationship tables (video-sound, video-hashtag)
4. **`sql/009_timeseries.sql`** - Time series tracking tables
5. **`sql/008_leaderboards.sql`** - Leaderboard views

### Authentication & Profiles

6. **`sql/018_profiles_and_auth.sql`** - User profiles and authentication tables
7. **`sql/031_fix_profile_trigger_error_handling.sql`** - Profile trigger fixes

### Video Processing

8. **`sql/014_rejected_videos.sql`** - Rejected videos table
9. **`sql/023_rejected_videos_enhancement.sql`** - Enhanced rejected videos
10. **`sql/024_submission_metadata.sql`** - Submission metadata tracking

### Ingestion Function

11. **`sql/011_ingestion_v2.sql`** - Base ingestion function (OR use multi-platform version)
12. **`sql/023_admin_bypass_validation.sql`** - Admin bypass validation (includes updated ingestion)
   
   **OR** (if you want multi-platform support):
   
   **`sql/028_multi_platform_ingestion.sql`** - Multi-platform ingestion (Instagram + YouTube)
   
   **Note:** Choose ONE ingestion function. The multi-platform version handles both Instagram and YouTube data structures.

### Aggregations & Stats

13. **`sql/013_add_play_counts.sql`** - Play count tracking
14. **`sql/012_aggregation.sql`** - Aggregation functions
15. **`sql/015_add_missing_tables_columns.sql`** - Additional columns
16. **`sql/019_impact_score.sql`** - Impact score calculations

### Daily Aggregations (Optional but Recommended)

17. **`sql/020_daily_aggregation_tables.sql`** - Daily stats tables
18. **`sql/021_daily_aggregation_functions.sql`** - Daily aggregation functions
19. **`sql/022_backfill_daily_stats.sql`** - Backfill function

### Communities (Optional)

20. **`sql/017_communities.sql`** - Communities feature
21. **`sql/024_community_membership_edit_flag.sql`** - Community membership flags
22. **`sql/025_community_rejected_video_functions.sql`** - Community functions

### Additional Features

23. **`sql/016_sound_functions.sql`** - Sound-related functions
24. **`sql/027_homepage_cache.sql`** - Homepage caching
25. **`sql/028_creator_contacts.sql`** - Creator contact management
26. **`sql/029_brand_contact_rate_limiting.sql`** - Rate limiting
27. **`sql/030_auth_rate_limiting.sql`** - Auth rate limiting
28. **`sql/025_fix_aggregation_error_handling.sql`** - Error handling fixes

## Step 3: Set Up Image Storage

### 3.1 Create Storage Bucket

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Name: `brightdata-results`
4. **Make it PUBLIC** (toggle "Public bucket" to ON)
5. Click **"Create bucket"**

### 3.2 Set Up Storage Policies

Run the SQL migration:

```bash
npx tsx scripts/run-sql.ts sql/026_image_storage_setup.sql
```

**OR** manually in Supabase SQL Editor:
- Copy contents of `sql/026_image_storage_setup.sql`
- Paste into SQL Editor
- Click "Run"

This sets up:
- Public read access
- Authenticated user upload access
- Service role full access

## Step 4: Verify Setup

### 4.1 Check Tables

Run in Supabase SQL Editor:

```sql
-- Check core tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'videos_hot', 'creators_hot', 'sounds_hot', 'hashtags_hot',
    'videos_cold', 'creator_profiles_cold', 'sounds_cold',
    'profiles', 'rejected_videos', 'submission_metadata',
    'bd_ingestions'
  )
ORDER BY table_name;
```

### 4.2 Check Functions

```sql
-- Check ingestion function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'ingest_brightdata_snapshot_v2';
```

### 4.3 Check Storage

```sql
-- Check storage bucket exists
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'brightdata-results';
```

Should return: `brightdata-results | brightdata-results | true`

### 4.4 Check Storage Policies

```sql
-- Check storage policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage';
```

Should show at least 3 policies for `brightdata-results` bucket.

## Step 5: Create Your First Admin User

After running the migrations, create an admin profile:

1. **Sign up** through your app's signup page
2. **Get your user ID** from Supabase Dashboard → Authentication → Users
3. **Update your profile** to admin:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

## Step 6: Test the Setup

### 6.1 Test Image Storage

```bash
# Test that storage bucket is accessible
curl https://your-project.supabase.co/storage/v1/bucket/brightdata-results
```

### 6.2 Test Ingestion Function

```sql
-- Test with mock data (Instagram format)
SELECT ingest_brightdata_snapshot_v2(
  'test_snapshot_123',
  'test_dataset',
  '[
    {
      "url": "https://www.instagram.com/p/ABC123",
      "post_id": "ABC123",
      "user_posted": "test_user",
      "description": "Test video #edit",
      "hashtags": ["edit", "test"],
      "views": 1000,
      "likes": 50,
      "num_comments": 10,
      "date_posted": "2024-01-01T00:00:00Z",
      "thumbnail": "https://example.com/image.jpg"
    }
  ]'::jsonb,
  false
);
```

### 6.3 Test YouTube Format

```sql
-- Test with YouTube Shorts format
SELECT ingest_brightdata_snapshot_v2(
  'test_snapshot_456',
  'test_dataset',
  '[
    {
      "url": "https://www.youtube.com/shorts/XYZ789",
      "video_id": "XYZ789",
      "youtuber_id": "UCW8Q9LBGGBgK6a-u0C0h95A",
      "youtuber": "@test_channel",
      "title": "Test Short #edit",
      "description": "Test YouTube Short",
      "hashtags": [{"hashtag": "#edit", "link": "https://youtube.com/hashtag/edit"}],
      "views": 5000,
      "likes": 200,
      "num_comments": 30,
      "date_posted": "2024-01-01T00:00:00Z",
      "preview_image": "https://example.com/image.jpg",
      "video_length": 30
    }
  ]'::jsonb,
  false
);
```

## Step 7: Initialize Homepage Cache (Optional)

After migrations, populate the homepage cache:

```sql
-- Populate all cache sections
SELECT refresh_homepage_cache(NULL);
```

## Quick Setup Script

You can also create a script to run all migrations in order. Create `scripts/setup-database.ts`:

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const migrations = [
  '006_hot_tables.sql',
  '007_cold_tables.sql',
  '010_fact_tables.sql',
  '009_timeseries.sql',
  '008_leaderboards.sql',
  '018_profiles_and_auth.sql',
  '031_fix_profile_trigger_error_handling.sql',
  '014_rejected_videos.sql',
  '023_rejected_videos_enhancement.sql',
  '024_submission_metadata.sql',
  '023_admin_bypass_validation.sql', // Or 028_multi_platform_ingestion.sql
  '013_add_play_counts.sql',
  '012_aggregation.sql',
  '015_add_missing_tables_columns.sql',
  '019_impact_score.sql',
  '020_daily_aggregation_tables.sql',
  '021_daily_aggregation_functions.sql',
  '022_backfill_daily_stats.sql',
  '017_communities.sql',
  '024_community_membership_edit_flag.sql',
  '025_community_rejected_video_functions.sql',
  '016_sound_functions.sql',
  '027_homepage_cache.sql',
  '028_creator_contacts.sql',
  '029_brand_contact_rate_limiting.sql',
  '030_auth_rate_limiting.sql',
  '025_fix_aggregation_error_handling.sql',
  '026_image_storage_setup.sql',
];

// Run migrations...
```

## Troubleshooting

### "Table already exists" errors
- Some migrations use `CREATE TABLE IF NOT EXISTS` - safe to re-run
- If you get errors, check if tables already exist

### "Function already exists" errors
- Most functions use `CREATE OR REPLACE FUNCTION` - safe to re-run
- If issues persist, drop the function first: `DROP FUNCTION IF EXISTS function_name(...)`

### Storage bucket errors
- Make sure bucket is created in Supabase Dashboard first
- Make sure bucket is set to PUBLIC
- Then run `sql/026_image_storage_setup.sql`

### Ingestion function errors
- Make sure you only run ONE ingestion function migration
- Choose either `023_admin_bypass_validation.sql` OR `028_multi_platform_ingestion.sql`
- The multi-platform version is recommended for Instagram + YouTube support

## Next Steps

After setup:
1. ✅ Test with a real Instagram URL upload
2. ✅ Test with a real YouTube Shorts URL upload
3. ✅ Verify webhook receives data correctly
4. ✅ Check that images are stored in Supabase Storage
5. ✅ Verify data appears in the database

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check function errors: Dashboard → Database → Functions
3. Verify RLS policies: Dashboard → Authentication → Policies

