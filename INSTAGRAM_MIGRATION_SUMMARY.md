# Instagram Migration Summary

This document summarizes the migration from TikTok to Instagram data sources using Bright Data.

## ✅ Completed Changes

### 1. Environment Variables
- ✅ Updated `BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID` → `BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID`
- ✅ Updated in `src/lib/env-server.ts`
- ✅ Updated in `src/app/api/brightdata/trigger/route.ts`
- ✅ Updated in `src/app/api/diagnostic/bulk-upload/route.ts`

### 2. URL Utilities
- ✅ Created `standardizeInstagramUrl()` function (supports `/p/` and `/reel/` formats)
- ✅ Created `isValidInstagramUrl()` function
- ✅ Kept legacy functions for backward compatibility
- ✅ Updated `src/lib/url-utils.ts`

### 3. API Routes
- ✅ Updated URL validation to check for `instagram.com` instead of `tiktok.com`
- ✅ Updated error messages to reference Instagram
- ✅ Updated `src/app/api/brightdata/trigger/route.ts`

### 4. UI Components
- ✅ Updated upload page placeholder text
- ✅ Updated `AsyncTikTokScraper` component (placeholder text)
- ✅ Updated `BulkUploadPanel` to use Instagram URL validation
- ✅ Updated error messages

### 5. Video Embedding
- ✅ Updated `VideoModal` to use Instagram embed URLs (`instagram.com/p/{postId}/embed`)
- ✅ Updated CSS from TikTok to Instagram styling
- ✅ Updated `src/app/components/VideoModal.tsx`
- ✅ Updated `src/app/globals.css`

### 6. Configuration Files
- ✅ Updated `package.json` name: `brightdata-instagram-ingestor`
- ✅ Updated `next.config.js` image domains (removed TikTok CDN, added Instagram CDN)
- ✅ Updated `scripts/bulk-upload.ts` to handle Instagram URLs

## ⚠️ Remaining Tasks

### 1. Database Schema Updates (REQUIRES MIGRATION)

The following database changes are needed but require careful migration:

#### Tables/Columns to Update:
- `tiktok_posts` table → Should be renamed to `instagram_posts` (or kept generic)
- `rejected_videos.tiktok_url` column → Should be renamed to `instagram_url` (or `post_url`)
- SQL function `ingest_brightdata_snapshot_v2()` → Update field mappings for Instagram data structure

#### Files to Update:
- `sql/011_ingestion_v2.sql` - Main ingestion function
- `sql/014_rejected_videos.sql` - Rejected videos table schema
- `src/lib/supabase.ts` - TypeScript type definitions

**Note**: The database schema changes should be done via migration scripts to avoid data loss.

### 2. Ingestion Function Updates

The `ingest_brightdata_snapshot_v2()` SQL function needs to be updated to:
- Map Instagram API response fields to database columns
- Handle Instagram-specific data structures (different from TikTok)
- Update field name mappings (e.g., Instagram may use different field names)

**Important**: You'll need to:
1. Review Bright Data's Instagram API response format
2. Map Instagram fields to your database schema
3. Update the ingestion function accordingly

### 3. Environment Variable Setup

Update your `.env.local` file:
```bash
# Change from:
BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID=your_scraper_id

# To:
BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID=your_instagram_scraper_id
```

## 📝 Notes

1. **Backward Compatibility**: Legacy functions (`standardizeTikTokUrl`, `isValidTikTokUrl`) are kept for backward compatibility but redirect to Instagram versions.

2. **Instagram URL Formats**: The migration supports both:
   - Posts: `https://www.instagram.com/p/{shortcode}`
   - Reels: `https://www.instagram.com/reel/{shortcode}`

3. **Embed URLs**: Instagram embeds use: `https://www.instagram.com/p/{postId}/embed`

4. **Data Structure Differences**: Instagram data from Bright Data may have different field names/structure than TikTok. You'll need to:
   - Review Bright Data's Instagram API documentation
   - Update the ingestion function to map Instagram fields correctly
   - Test with real Instagram data

## 🔍 Testing Checklist

- [ ] Update environment variable `BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID`
- [ ] Test single URL upload with Instagram post URL
- [ ] Test single URL upload with Instagram reel URL
- [ ] Test bulk upload with CSV containing Instagram URLs
- [ ] Verify webhook receives Instagram data correctly
- [ ] Verify ingestion function processes Instagram data
- [ ] Test video embed modal with Instagram posts
- [ ] Verify database schema can handle Instagram data structure

## 🚨 Important Warnings

1. **Database Migration**: The database schema changes are critical and should be tested in a development environment first.

2. **Data Loss Risk**: Renaming tables/columns may cause issues if there's existing TikTok data. Consider:
   - Creating new tables for Instagram data
   - Or migrating existing data before renaming

3. **API Response Format**: Instagram API responses from Bright Data may differ significantly from TikTok. Review the API documentation carefully.

4. **Field Mappings**: Instagram may use different field names (e.g., `like_count` vs `digg_count`, `view_count` vs `play_count`). Update mappings accordingly.

