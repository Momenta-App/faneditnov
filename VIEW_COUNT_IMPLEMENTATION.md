# View Count Ranking Implementation Guide

## Overview

This document outlines the implementation steps to enable ranking of videos, creators, hashtags, and sounds by total view count using Bright Data's `play_count` field.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Changes](#architecture-changes)
3. [Database Schema Updates](#database-schema-updates)
4. [Ingestion Logic Updates](#ingestion-logic-updates)
5. [API Route Updates](#api-route-updates)
6. [Frontend Updates](#frontend-updates)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Checklist](#deployment-checklist)

---

## Current State Analysis

### Existing Infrastructure

✅ **Already in Place:**
- Hot tables: `creators_hot`, `videos_hot`, `sounds_hot`, `hashtags_hot`
- View count fields exist: `views_count`, `views_total`
- Ingestion function: `ingest_brightdata_snapshot_v2`
- Aggregation function: `update_aggregations`
- API routes for all entities
- Fact tables: `video_sound_facts`, `video_hashtag_facts`

❌ **Missing:**
- Delta calculation logic to prevent overcounting
- Automatic aggregation on video updates
- Proper ordering by view counts in API routes
- Total view count tracking for creators

---

## Architecture Changes

### Core Flow

```
Bright Data Webhook
       ↓
ingest_brightdata_snapshot_v2()
       ↓
1. Extract play_count from video
2. Calculate delta (new - old)
3. Update video.views_count
4. Add delta to:
   - creator's total_play_count
   - sound's views_total
   - hashtag's views_total
       ↓
update_aggregations() (optional periodic refresh)
```

### Key Principle: Delta-Based Updates

**Critical Requirement:** We must track the previous `play_count` for each video to calculate the delta and avoid overcounting when the same video is processed multiple times.

---

## Database Schema Updates

### 1. Add `total_play_count` to Creators

**File:** `sql/013_add_play_counts.sql` (create new file)

```sql
-- Add total_play_count column to creators_hot
ALTER TABLE creators_hot 
ADD COLUMN IF NOT EXISTS total_play_count BIGINT DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_creators_total_play_count 
ON creators_hot(total_play_count DESC);

COMMENT ON COLUMN creators_hot.total_play_count IS 'Sum of all videos views_count for this creator';
```

### 2. Verify Existing Columns

Ensure these columns exist and have proper indexes:

```sql
-- Verify views_count in videos_hot
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'videos_hot' 
AND column_name = 'views_count';

-- Should show: views_count | integer

-- Verify views_total in sounds_hot
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sounds_hot' 
AND column_name = 'views_total';

-- Verify views_total in hashtags_hot
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hashtags_hot' 
AND column_name = 'views_total';
```

### 3. Add Staging Table for Delta Calculation

**File:** `sql/013_add_play_counts.sql` (add to same file)

```sql
-- Staging table to track previous play_count
CREATE TABLE IF NOT EXISTS video_play_count_history (
  video_id TEXT PRIMARY KEY REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  previous_play_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_play_history_video_id 
ON video_play_count_history(video_id);

COMMENT ON TABLE video_play_count_history IS 'Track previous play_count to calculate deltas and prevent overcounting';
```

---

## Ingestion Logic Updates

### Update: `ingest_brightdata_snapshot_v2` Function

**File:** `sql/011_ingestion_v2.sql` (modify existing)

#### Changes Needed:

1. **Before updating video**, fetch the previous `play_count`
2. **Calculate delta** = new `play_count` - old `play_count`
3. **Update totals** using the delta
4. **Store new `play_count`** in history table

#### Modified Function (Key Sections):

Replace the video upsert section (lines 118-148) with:

```sql
-- =======================================================================
-- UPSERT VIDEO (HOT) WITH DELTA CALCULATION
-- =======================================================================
-- This code should replace the existing video upsert section in the function
-- Add these variable declarations at the FUNCTION level (in the main DECLARE block):
-- DECLARE
--   v_new_play_count INTEGER;
--   v_old_play_count INTEGER := 0;
--   v_delta INTEGER;

BEGIN
  -- Get new play_count from payload
  v_new_play_count := COALESCE((v_element->>'play_count')::INTEGER, 0);

  -- Fetch previous play_count from history
  SELECT previous_play_count INTO v_old_play_count
  FROM video_play_count_history
  WHERE video_id = v_post_id;

  -- If no history, set to 0 (this is a new video)
  IF v_old_play_count IS NULL THEN
    v_old_play_count := 0;
  END IF;

  -- Calculate delta
  v_delta := v_new_play_count - v_old_play_count;

  -- Upsert video with new play_count
  INSERT INTO videos_hot (
    video_id, post_id, creator_id, url, caption, description,
    created_at, views_count, likes_count, comments_count,
    shares_count, duration_seconds, video_url, cover_url
  )
  VALUES (
    v_post_id,
    v_post_id,
    v_creator_id,
    v_element->>'url',
    COALESCE(v_element->>'description', v_element->>'caption', ''),
    COALESCE(v_element->>'description', v_element->>'caption', ''),
    COALESCE(
      (v_element->>'create_time')::TIMESTAMP WITH TIME ZONE,
      to_timestamp((v_element->>'createTime')::BIGINT)
    ),
    v_new_play_count,  -- Store new play_count
    COALESCE((v_element->>'digg_count')::INTEGER, 0),
    COALESCE((v_element->>'comment_count')::INTEGER, 0),
    COALESCE((v_element->>'share_count')::INTEGER, 0),
    COALESCE((v_element->>'video_duration')::INTEGER, (v_element->>'duration_seconds')::INTEGER),
    v_element->>'video_url',
    COALESCE(v_element->>'preview_image', v_element->>'cover_url')
  )
  ON CONFLICT (video_id) DO UPDATE SET
    views_count = EXCLUDED.views_count,
    likes_count = EXCLUDED.likes_count,
    comments_count = EXCLUDED.comments_count,
    shares_count = EXCLUDED.shares_count,
    last_seen_at = NOW(),
    updated_at = NOW();

  -- Update play count history
  INSERT INTO video_play_count_history (video_id, previous_play_count, last_updated)
  VALUES (v_post_id, v_new_play_count, NOW())
  ON CONFLICT (video_id) DO UPDATE SET
    previous_play_count = EXCLUDED.previous_play_count,
    last_updated = NOW();

  -- ONLY UPDATE TOTALS IF DELTA IS POSITIVE
  IF v_delta > 0 THEN
    -- Update creator's total_play_count
    UPDATE creators_hot
    SET total_play_count = total_play_count + v_delta,
        updated_at = NOW()
    WHERE creator_id = v_creator_id;

    -- Update sound's views_total (if sound exists)
    IF v_sound_id IS NOT NULL THEN
      UPDATE sounds_hot
      SET views_total = views_total + v_delta,
          updated_at = NOW()
      WHERE sound_id = v_sound_id;
    END IF;
  END IF;

  -- Process hashtags with delta
  FOR v_hashtag IN 
    SELECT value::TEXT 
    FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
  LOOP
    v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
    
    INSERT INTO hashtags_hot (hashtag, hashtag_norm, updated_at)
    VALUES (v_hashtag, v_hashtag, NOW())
    ON CONFLICT (hashtag) DO UPDATE SET
      last_seen_at = NOW(),
      updated_at = NOW();

    INSERT INTO video_hashtag_facts (video_id, hashtag, snapshot_at, views_at_snapshot, likes_at_snapshot)
    VALUES (
      v_post_id,
      v_hashtag,
      NOW(),
      v_new_play_count,
      COALESCE((v_element->>'digg_count')::INTEGER, 0)
    )
    ON CONFLICT (video_id, hashtag) DO UPDATE SET
      snapshot_at = NOW(),
      views_at_snapshot = EXCLUDED.views_at_snapshot,
      likes_at_snapshot = EXCLUDED.likes_at_snapshot;

    -- Update hashtag's views_total with delta
    IF v_delta > 0 THEN
      UPDATE hashtags_hot
      SET views_total = views_total + v_delta,
          updated_at = NOW()
      WHERE hashtag = v_hashtag;
    END IF;
  END LOOP;
END;
```

### Important Notes:

1. **Delta Only Applied if Positive**: We only add the delta to totals if it's positive. This prevents negative counts if a video's view count decreases (data correction).
2. **History Tracking**: We always store the new play_count in the history table, even if the delta is 0 or negative.
3. **New Videos**: For new videos (no history), the delta equals the full play_count.

---

## Aggregation Updates

### Update: `update_aggregations` Function

**File:** `sql/012_aggregation.sql` (modify existing)

Add creator's total_play_count calculation to the function:

```sql
-- UPDATE CREATOR COUNTS (replace lines 22-40)
UPDATE creators_hot c
SET 
  videos_count = (
    SELECT COUNT(*) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  likes_total = (
    SELECT COALESCE(SUM(likes_count), 0) 
    FROM videos_hot v 
    WHERE v.creator_id = c.creator_id
  ),
  total_play_count = (
    SELECT COALESCE(SUM(views_count), 0)
    FROM videos_hot v
    WHERE v.creator_id = c.creator_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
);
```

---

## API Route Updates

### 1. Update Videos API to Order by Views

**File:** `src/app/api/videos/route.ts`

Modify line 26:

```typescript
.order('views_count', { ascending: false })  // Changed from 'created_at'
```

### 2. Update Creators API

**File:** `src/app/api/creators/route.ts` (may need to create or update)

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const search = searchParams.get('search') || '';

    // Query from creators_hot ordered by total_play_count
    let query = supabaseAdmin
      .from('creators_hot')
      .select('*')
      .order('total_play_count', { ascending: false })  // Rank by total views
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching creators:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map((creator: any) => ({
      id: creator.creator_id,
      username: creator.username || 'unknown',
      displayName: creator.display_name || creator.username || 'Unknown',
      bio: creator.bio || '',
      avatar: creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.username)}&background=120F23&color=fff`,
      verified: creator.verified || false,
      followers: creator.followers_count || 0,
      videos: creator.videos_count || 0,
      likes: creator.likes_total || 0,
      views: creator.total_play_count || 0,  // Add total views
    })) || [];

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Error in creators API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. Update Hashtags API

**File:** `src/app/api/hashtags/route.ts` (already correct at line 16)

Ensure it's ordering by `views_total`:
```typescript
.order('views_total', { ascending: false })  // Already correct
```

### 4. Update Sounds API

**File:** `src/app/api/sounds/route.ts`

Modify line 16:

```typescript
.order('views_total', { ascending: false })  // Changed from 'videos_count'
```

---

## Frontend Updates

### 1. Update Type Definitions

**File:** `src/app/types/data.ts`

```typescript
export interface Creator {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  verified: boolean;
  followers: number;
  videos: number;
  likes: number;
  views: number;  // Add this field
}

export interface Hashtag {
  id: string;
  name: string;
  views: number;  // This already exists and maps to views_total
  videos: number;
  trending: boolean;
  description?: string;
  creators?: number;
}

export interface Sound {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videos: number;
  views?: number;  // Add this field (or make it required)
  likes?: number;
}
```

### 2. Update Sort Options

**File:** `src/app/components/filters/index.ts`

```typescript
export const CREATOR_SORT_OPTIONS = [
  { value: 'views', label: 'Most Views' },      // Add this
  { value: 'followers', label: 'Most Followers' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'newest', label: 'Newest' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

export const VIDEO_SORT_57364934/OPTIONS = [
  { value: 'views', label: 'Most Views' },       // Add this
  { value: 'likes', label: 'Most Likes' },
  { value: 'recent', label: 'Most Recent' },
];

export const HASHTAG_SORT_OPTIONS = [
  { value: 'views', label: 'Most Views' },       // Add this
  { value: 'videos', label: 'Most Videos' },
  { value: 'trending', label: 'Trending' },
];

export const SOUND_SORT_OPTIONS = [
  { value: 'views', label: 'Most Views' },       // Add this
  { value: 'videos', label: 'Most Videos' },
  { value: 'recent', label: 'Recently Used' },
];
```

### 3. Update Sorting Logic in Pages

**File:** `src/app/creators/page.tsx`

Add to the sort logic (around line 33):

```typescript
case 'views':
  filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
  break;
```

Add similar logic to:
- `src/app/sounds/page.tsx`
- `src/app/hashtags/page.tsx`

---

## Testing Strategy

### 1. Database Migration Test

```bash
# Run the new SQL file
psql $DATABASE_URL -f sql/013_add_play_counts.sql

# Verify columns were added
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'creators_hot' AND column_name = 'total_play_count';"
```

### 2. Ingestion Function Test

```bash
# Test with a single video update
curl -X POST http://localhost:3000/api/manual-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "test_video_123",
    "profile_id": "test_creator_123",
    "play_count": 10000,
    "digg_count": 500,
    "description": "Test video"
  }'

# Verify the delta was calculated correctly
psql $DATABASE_URL -c "SELECT video_id, views_count FROM videos_hot WHERE video_id = 'test_video_123';"
psql $DATABASE_URL -c "SELECT video_id, previous_play_count FROM video_play_count_history WHERE video_id = 'test_video_123';"

# Update the same video with higher play_count
curl -X POST http://localhost:3000/api/manual-webhook \
  -d '{"post_id": "test_video_123", "profile_id": "test_creator_123", "play_count": 15000}'

# Verify only the delta (5000) was added to totals
psql $DATABASE_URL -c "SELECT total_play_count FROM creators_hot WHERE creator_id = 'test_creator_123';"
```

### 3. API Endpoint Test

```bash
# Test videos endpoint ordering
curl http://localhost:3000/api/videos | jq '.data[0:3] | .[] | {id, views}'

# Test creators endpoint ordering
curl http://localhost:3000/api/creators | jq '.data[0:3] | .[] | {username, views}'

# Test hashtags endpoint
curl http://localhost:3000/api/hashtags | jq '.data[0:3] | .[] | {name, views}'

# Test sounds endpoint
curl http://localhost:3000/api/sounds | jq '.data[0:3] | .[] | {title, views}'
```

### 4. Data Integrity Test

```sql
-- Verify totals match sum of individual videos
SELECT 
  c.creator_id,
  c.total_play_count as creator_total,
  COALESCE(SUM(v.views_count), 0) as sum_of_videos
FROM creators_hot c
LEFT JOIN videos_hot v ON v.creator_id = c.creator_id
GROUP BY c.creator_id, c.total_play_count
HAVING c.total_play_count != COALESCE(SUM(v.views_count), 0)
LIMIT 10;
-- Should return 0 rows if data is consistent
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run `sql/013_add_play_counts.sql` on production database
- [ ] Update `sql/011_ingestion_v2.sql` with delta calculation logic
- [ ] Update `sql/012_aggregation.sql` to include total_play_count
- [ ] Run aggregation function to initialize totals: `SELECT update_aggregations();`

### Code Deployment

- [ ] Deploy updated `src/app/api/videos fabricate.ts`
- [ ] Deploy updated `src/app/api/creators/route.ts`
- [ ] Deploy updated `src/app/api/hashtags/route.ts`
- [ ] Deploy updated `src/app/api/sounds/route.ts`
- [ ] Deploy updated frontend pages with sort options
- [ ] Deploy updated type definitions

### Post-Deployment

- [ ] Monitor webhook logs for errors
- [ ] Verify delta calculations in application logs
- [ ] Test with a real Bright Data webhook
- [ ] Verify leaderboard pages load and display correctly
- [ ] Run data integrity check (SQL above)
- [ ] Set up monitoring alert for any overcounting issues

---

## Rollback Plan

If issues occur:

1. **Immediate**: Disable the delta calculation temporarily
2. **Database**: Run aggregation function to recalculate all totals
3. **Re-deploy**: Previous version of ingestion function without delta logic

```sql
-- Emergency: Recalculate all totals from scratch
SELECT update_aggregations();

-- Or manually for creators
UPDATE creators_hot c
SET total_play_count = (
  SELECT COALESCE(SUM(views_count), 0) 
  FROM videos_hot v 
  WHERE v.creator_id = c.creator_id
);
```

---

## Performance Considerations

### Indexing
All necessary indexes should already be in place:
- `idx_creators_total_play_count` on creators_hot
- `idx_videos_views` on videos_hot
- `idx_hashtags_views` on hashtags_hot
- `idx_sounds_views_total` on sounds_hot

### Query Performance
- Leaderboard queries should be fast with DESC indexes
- Consider adding pagination to all endpoints if not already present
- Monitor query execution times after deployment

### Maintenance
- Run `update_aggregations()` periodically as a safety net (daily cron)
- Monitor `video_play_count_history` table size
- Consider archiving old history records (keep last 90 days)

---

## Summary

This implementation enables:

✅ **Video ranking** by individual view count
✅ **Creator ranking** by total views across all their videos
✅ **Hashtag ranking** by total views of all videos using that hashtag
✅ **Sound ranking** by total views of all videos using that sound
✅ **Delta-based updates** to prevent overcounting
✅ **Real-time leaderboards** that update with each ingestion

**Key Innovation:** The delta calculation system ensures that each view count change only affects totals once, even if the same video is processed multiple times.
