# Multi-Platform Support Setup

This document outlines the multi-platform support for Instagram and YouTube Shorts.

## ✅ Completed Implementation

### 1. URL Utilities (`src/lib/url-utils.ts`)
- ✅ Added `detectPlatform()` - Detects if URL is Instagram or YouTube
- ✅ Added `standardizeYouTubeUrl()` - Standardizes YouTube Shorts URLs
- ✅ Added `isValidYouTubeUrl()` - Validates YouTube URLs
- ✅ Added `standardizeUrl()` - Universal URL standardization
- ✅ Added `isValidUrl()` - Universal URL validation

**Supported YouTube Formats:**
- `https://www.youtube.com/shorts/{videoId}`
- `https://youtu.be/{videoId}`
- `https://www.youtube.com/watch?v={videoId}` (converted to shorts format)

### 2. Environment Variables
- ✅ Added `BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID` (optional)
- ✅ Updated `src/lib/env-server.ts` to include YouTube scraper ID
- ✅ Made YouTube scraper ID optional (won't fail if not set)

### 3. API Routes
- ✅ Updated `src/app/api/brightdata/trigger/route.ts`:
  - Detects platform from URLs
  - Uses appropriate scraper ID based on platform
  - Validates all URLs are from the same platform per batch
  - Returns clear error messages for missing scraper IDs

### 4. UI Components
- ✅ Updated upload page to support both platforms
- ✅ Updated bulk upload panel to handle Instagram and YouTube URLs
- ✅ Updated placeholders and error messages

### 5. Configuration
- ✅ Updated `next.config.js` to allow YouTube image domains
- ✅ Updated diagnostic route to show platform configuration status

## 🔧 Environment Setup

Add to your `.env.local`:

```bash
# Required
BRIGHT_DATA_API_KEY=your_api_key
BRIGHT_DATA_CUSTOMER_ID=your_customer_id
BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID=your_instagram_scraper_id

# Optional (for YouTube Shorts)
BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID=your_youtube_scraper_id
```

**Note:** At least one platform scraper ID must be configured.

## 📝 Usage

### Single Upload
Users can paste either:
- Instagram: `https://www.instagram.com/p/ABC123` or `https://www.instagram.com/reel/XYZ789`
- YouTube: `https://www.youtube.com/shorts/ABC123` or `https://youtu.be/ABC123`

### Bulk Upload
CSV files can contain URLs from either platform, but all URLs in a single batch must be from the same platform.

## ⚠️ Important Notes

1. **Platform Detection**: The system automatically detects the platform from the URL and uses the appropriate Bright Data scraper.

2. **Batch Requirements**: All URLs in a single batch must be from the same platform. Mixed platforms in one batch will be rejected.

3. **YouTube Scraper**: The YouTube Shorts scraper ID is optional. If not configured, YouTube URLs will be rejected with a clear error message.

4. **Database Schema**: The database schema should be platform-agnostic. The ingestion function will need to handle data from both platforms. You may need to:
   - Add a `platform` column to track the source
   - Update field mappings for YouTube data structure (may differ from Instagram)

5. **Data Structure Differences**: Instagram and YouTube data from Bright Data may have different field names. The ingestion function (`ingest_brightdata_snapshot_v2`) will need to handle both formats.

## 🧪 Testing Checklist

- [ ] Test Instagram URL upload (single)
- [ ] Test YouTube Shorts URL upload (single)
- [ ] Test bulk upload with Instagram URLs
- [ ] Test bulk upload with YouTube URLs
- [ ] Test error handling for mixed platforms
- [ ] Test error handling when YouTube scraper not configured
- [ ] Verify webhook receives data correctly for both platforms
- [ ] Verify ingestion function processes both data formats

## 🔄 Next Steps

1. **Database Schema**: Update database to be platform-agnostic (add `platform` field if needed)

2. **Ingestion Function**: Update `ingest_brightdata_snapshot_v2()` SQL function to:
   - Detect platform from incoming data
   - Map YouTube fields correctly (may differ from Instagram)
   - Store platform information

3. **Video Embedding**: Update `VideoModal` component to handle YouTube embeds:
   - YouTube embed format: `https://www.youtube.com/embed/{videoId}`
   - Different from Instagram embeds

4. **Field Mappings**: Review Bright Data API responses for both platforms and update field mappings accordingly.

