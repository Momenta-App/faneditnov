# Community Non-Edit Videos Implementation Summary

## Overview

Successfully implemented support for communities to track and display non-edit videos (videos without "edit" hashtag) alongside edit videos. Community pages now have an "Edits Only" toggle that filters the displayed content while community stats always show combined totals.

## Completed Changes

### 1. Database Schema Migrations

#### `sql/023_rejected_videos_enhancement.sql`
- Added structured columns to `rejected_videos` table:
  - `video_id`, `title`, `description`
  - `views_count`, `likes_count`, `comments_count`, `shares_count`
  - `video_created_at`, `hashtags[]`, `sound_id`, `impact_score`
- Added indexes for performance optimization

#### `sql/024_community_membership_edit_flag.sql`
- Added `is_edit_video` boolean flag to `community_video_memberships`
- Added composite indexes for efficient filtering

#### `sql/025_community_rejected_video_functions.sql`
- New functions for rejected video handling:
  - `check_rejected_video_community_match()` - Check if rejected video matches community
  - `update_community_video_membership_rejected()` - Add/remove rejected videos from communities
  - `backfill_community_rejected_videos()` - Backfill existing rejected videos
- Enhanced existing functions to handle both video types:
  - `update_community_totals()` - Now includes both edit and non-edit videos
  - `sync_community_hashtags()` - Syncs both video types when hashtags change
  - `recalculate_community_hashtag_memberships()` - Recalculates with both types
  - `recalculate_community_creator_memberships()` - Recalculates with both types

### 2. Ingestion Logic Updates

#### `sql/011_ingestion_v2.sql`
- Modified `ingest_brightdata_snapshot_v2()` function
- When a video is rejected (no "edit" hashtag):
  - Extracts structured data from JSONB payload
  - Populates new `rejected_videos` columns
  - Checks if hashtags match any community
  - Automatically adds to community memberships as non-edit video
- Updates rejected videos on subsequent ingestions

### 3. API Endpoints

#### `src/app/api/communities/[id]/videos/route.ts`
- Added `editsOnly` query parameter (default: true)
- Queries both `videos_hot` (edit) and `rejected_videos` (non-edit)
- Merges and sorts results client-side
- Maintains separate hashtag sources for each type

#### `src/app/api/communities/[id]/creators/route.ts`
- Added `editsOnly` query parameter (default: true)
- When false: uses pre-calculated totals from `community_creator_memberships`
- When true: recalculates stats on-the-fly filtering only edit videos

#### `src/app/api/communities/[id]/hashtags/route.ts`
- Added `editsOnly` query parameter (default: true)
- When false: uses pre-calculated totals from `community_hashtag_memberships`
- When true: recalculates stats on-the-fly filtering only edit videos

### 4. Frontend Changes

#### `src/app/hooks/useData.ts`
- Updated `useCommunityVideos()` - Added `editsOnly` parameter
- Updated `useCommunityCreators()` - Added `editsOnly` parameter
- Updated `useCommunityHashtags()` - Added `editsOnly` parameter
- All hooks pass the parameter to their respective API endpoints

#### `src/app/community/[slug]/page.tsx`
- Added `editsOnly` state (default: true)
- Added toggle UI below tabs, above content:
  - Styled button with checkmark/circle indicator
  - Helper text explaining current filter
  - Always ON by default (no persistence)
- Passed `editsOnly` to all data hooks

### 5. Backfill Script

#### `scripts/backfill-rejected-videos.sql`
Created comprehensive backfill script that:
1. Extracts structured data from existing `rejected_videos.original_data` JSONB
2. Updates all rows with new column values
3. Adds rejected videos to community memberships where hashtags match
4. Updates community totals
5. Provides summary statistics and per-community breakdown

## Remaining Tasks

### REQUIRED: Run Database Migrations

You need to execute the following SQL files in order on your Supabase database:

```bash
# 1. Enhance rejected_videos table
psql -f sql/023_rejected_videos_enhancement.sql

# 2. Add is_edit_video flag to memberships
psql -f sql/024_community_membership_edit_flag.sql

# 3. Create new functions for rejected video handling
psql -f sql/025_community_rejected_video_functions.sql

# 4. Backfill existing data (ONE TIME ONLY)
psql -f scripts/backfill-rejected-videos.sql
```

**Note**: Replace `psql` with your Supabase connection method. You can also run these through the Supabase SQL Editor.

### Testing Checklist

After running migrations, test the following:

#### 1. Ingestion
- [ ] New videos without "edit" hashtag are rejected
- [ ] Rejected videos have structured data populated
- [ ] Rejected videos are automatically added to matching communities
- [ ] Stats are updated correctly

#### 2. Community Page Toggle
- [ ] Toggle defaults to ON (Edits Only)
- [ ] Toggle switches between states smoothly
- [ ] Videos tab filters correctly when toggled
- [ ] Creators tab filters correctly when toggled
- [ ] Hashtags tab filters correctly when toggled
- [ ] Community stats remain the same regardless of toggle state

#### 3. Hashtag Sync
- [ ] Adding hashtags to a community adds both edit and non-edit videos
- [ ] Removing hashtags from a community removes both video types
- [ ] Stats are recalculated correctly after sync

#### 4. Data Accuracy
- [ ] Community totals include both video types
- [ ] Video counts are accurate
- [ ] View counts are accurate
- [ ] Creator counts are accurate
- [ ] Impact scores are calculated correctly for rejected videos

## Key Features

### Automatic Community Population
- New rejected videos are automatically checked against all communities
- If hashtags match, they're added to community memberships instantly
- No manual intervention required for new videos

### Dual Video Sources
- Edit videos: from `videos_hot` table (standard ingestion)
- Non-edit videos: from `rejected_videos` table (quality-controlled)
- Seamlessly merged in API responses

### Performance Optimizations
- Pre-calculated totals for "all videos" mode (faster)
- On-the-fly calculations for "edits only" mode (accurate)
- Indexed queries for fast filtering
- Efficient hashtag matching using GIN indexes

### User Experience
- Toggle is intuitive and clearly labeled
- Stats always show full community strength
- Videos can be filtered without affecting displayed metrics
- No data loss - all videos tracked in appropriate tables

## Important Notes

1. **Stats Always Include Both**: Community stats (total_views, total_videos, etc.) ALWAYS include both edit and non-edit videos, regardless of toggle state.

2. **Toggle Affects Display Only**: The "Edits Only" toggle only filters what's displayed in the videos, creators, and hashtags lists. It doesn't change the stats shown at the top.

3. **Non-Edit Videos Never Appear Elsewhere**: Videos without "edit" hashtags will NEVER appear on:
   - Home page
   - Leaderboards
   - Hashtag pages (outside communities)
   - Creator pages (outside communities)
   - Site-wide rankings

4. **Backfill Is One-Time**: The backfill script should only be run once after migrations. Future videos are handled automatically by the ingestion function.

5. **Performance**: When "editsOnly" is false, the system uses pre-calculated aggregates. When true, it recalculates on-the-fly, which may be slightly slower but ensures accuracy.

## Architecture Decisions

### Why Keep Rejected Videos Separate?
- Maintains data quality for main site features
- Allows communities to have broader content
- Prevents non-edit videos from polluting global stats
- Easier to manage and query separately

### Why Use Boolean Flag in Memberships?
- Single table simplifies queries
- Easier to maintain referential integrity
- Faster joins and aggregations
- Cleaner API responses

### Why Recalculate vs Pre-calculate for Edits Only?
- Pre-calculating both would require duplicate columns
- Edit-only view is the default and performance-critical
- All-videos view uses pre-calculated totals (already done)
- On-the-fly calculation for edits-only ensures consistency

## Files Modified/Created

### SQL Migrations (NEW)
- `sql/023_rejected_videos_enhancement.sql`
- `sql/024_community_membership_edit_flag.sql`
- `sql/025_community_rejected_video_functions.sql`

### SQL Updates (MODIFIED)
- `sql/011_ingestion_v2.sql`

### Scripts (NEW)
- `scripts/backfill-rejected-videos.sql`

### API Routes (MODIFIED)
- `src/app/api/communities/[id]/videos/route.ts`
- `src/app/api/communities/[id]/creators/route.ts`
- `src/app/api/communities/[id]/hashtags/route.ts`

### Frontend (MODIFIED)
- `src/app/hooks/useData.ts`
- `src/app/community/[slug]/page.tsx`

## Next Steps

1. **Review migrations** - Ensure they match your database schema
2. **Run migrations** - Execute SQL files in order
3. **Run backfill** - Populate existing communities with rejected videos
4. **Test thoroughly** - Verify all functionality works as expected
5. **Monitor performance** - Check API response times with larger datasets
6. **Consider adding analytics** - Track toggle usage and popular non-edit videos

## Support

If you encounter issues:
1. Check Supabase logs for SQL errors
2. Verify all migrations ran successfully
3. Check browser console for API errors
4. Ensure Supabase RLS policies allow the operations
5. Verify indexes were created successfully

The implementation is complete and ready for deployment!

