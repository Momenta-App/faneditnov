# Sound Detail Page Development Plan

## Goal

Enable a sound detail page at `/sound/[soundId]` that shows all videos using the sound, plus a ranked list of creators who used the sound. Fix the main Sounds page to show the accurate number of videos per sound.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Database Schema**
   - `sounds_hot` table exists with:
     - `sound_id` (PRIMARY KEY)
     - `sound_title`, `sound_author`
     - `views_total`, `videos_count`, `likes_total`
     - `cover_url`, `music_url`, `music_play_url`
     - `first_used_at`, `last_used_at`
   - `video_sound_facts` table exists for tracking video-sound relationships
   - `sounds_cold` table for full JSON storage
   - Indexes already created on `sound_id`, `views_total`, `videos_count`

2. **Ingestion Pipeline**
   - `ingest_brightdata_snapshot_v2()` already extracts `sound_id` from JSON
   - Updates `sounds_hot` on video ingest
   - Creates/updates `video_sound_facts` relationships
   - Tracks views delta on sound aggregates

3. **Frontend Infrastructure**
   - `/sounds` page exists (`src/app/sounds/page.tsx`)
   - `useSounds()` hook exists (`src/app/hooks/useData.ts`)
   - `/api/sounds/route.ts` API endpoint exists
   - `Sound` type exists (`src/app/types/data.ts`)
   - Similar pattern already implemented for hashtags

### Current Issues ⚠️

1. Video counts showing 0 on main Sounds page
2. No detail page for individual sounds
3. No ranked creators list for sounds
4. No search/filter on sound detail page

---

## Development Tasks

### Phase 1: Database Functions & Backend Infrastructure

#### Task 1.1: Create SQL Helper Function for Sound Creators
**File:** `sql/016_sound_functions.sql` (new file)

Create a PostgreSQL function to efficiently aggregate creator data for sounds, similar to the `get_hashtag_creators` function pattern.

```sql
CREATE OR REPLACE FUNCTION get_sound_creators(p_sound_id TEXT)
RETURNS TABLE (
  creator_id TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  bio TEXT,
  total_views BIGINT,
  video_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.creator_id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.verified,
    c.bio,
    SUM(v.views_count)::BIGINT AS total_views,
    COUNT(DISTINCT vsf.video_id)::INTEGER AS video_count
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  JOIN creators_hot c ON c.creator_id = v.creator_id
  WHERE vsf.sound_id = p_sound_id
  GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.bio
  ORDER BY total_views DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```

**Why:** Efficient aggregation at the database level, avoiding multiple round trips and complex joins in the application layer.

#### Task 1.2: Verify Sound Aggregation Updates
**File:** `sql/012_aggregation.sql`

Verify that the existing aggregation function `update_sound_aggregates()` is being called and properly updates video counts. Add logging if needed.

**Action:** Review and potentially add a scheduled job to ensure sound aggregates are updated regularly.

#### Task 1.3: Backfill Sound Video Counts (if needed)
**File:** `scripts/fix-sound-video-counts.sql` (new file)

Create a one-time script to recompute `videos_count` for all sounds from `video_sound_facts`.

```sql
-- Fix video counts for all sounds
UPDATE sounds_hot s
SET videos_count = (
  SELECT COUNT(DISTINCT video_id) 
  FROM video_sound_facts vsf 
  WHERE vsf.sound_id = s.sound_id
),
views_total = (
  SELECT COALESCE(SUM(v.views_count), 0)
  FROM video_sound_facts vsf
  JOIN videos_hot v ON v.video_id = vsf.video_id
  WHERE vsf.sound_id = s.sound_id
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
);
```

---

### Phase 2: API Routes

#### Task 2.1: Create Sound Videos API Route
**File:** `src/app/api/sounds/[soundId]/videos/route.ts` (new file)

Create API endpoint to fetch videos for a specific sound with search, sorting, and pagination support.

**Parameters:**
- `soundId` (path param)
- `search` (query param)
- `sort` (query param: 'recent', 'views', 'likes', 'trending')
- `timeRange` (query param: 'all', '24h', '7d', '30d', '1y')
- `limit` (query param, default: 100)
- `offset` (query param, default: 0)

**Implementation Pattern:** Mirror `src/app/api/hashtags/[tag]/videos/route.ts`

**Key Queries:**
1. Get video IDs from `video_sound_facts` filtered by `sound_id`
2. Query `videos_hot` with those IDs
3. Apply search filter on caption/description
4. Apply time range filter on `created_at`
5. Sort by specified field
6. Join with `creators_hot` for creator data
7. Fetch hashtags from `video_hashtag_facts`

#### Task 2.2: Create Sound Creators API Route
**File:** `src/app/api/sounds/[soundId]/creators/route.ts` (new file)

Create API endpoint to fetch ranked creators for a specific sound.

**Parameters:**
- `soundId` (path param)

**Implementation:**
- Call `get_sound_creators(soundId)` function
- Fallback to manual aggregation if function doesn't exist (mirror hashtag pattern)

**Response Format:**
```typescript
{
  data: Array<{
    creator_id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    verified: boolean;
    bio: string;
    total_views: number;  // Total views for this sound only
    video_count: number;  // Number of videos using this sound
  }>
}
```

---

### Phase 3: Frontend Hooks

#### Task 3.1: Add Sound Data Hooks
**File:** `src/app/hooks/acency.ts`

Add new hooks following the hashtag pattern:

```typescript
export function useSoundVideos(
  soundId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100
) {
  // Fetch from /api/sounds/[soundId]/videos
}

export function useSoundCreators(soundId: string) {
  // Fetch from /api/sounds/[soundId]/creators
}
```

#### Task 3.2: Add Sound Types
**File:** `src/app/types/data.ts`

Add `SoundCreator` interface:

```typescript
export interface SoundCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  bio: string;
  total_views: number;  // Total views for this sound
  video_count: number;  // Number of videos using this sound
}
```

---

### Phase 4: Sound Detail Page UI

#### Task 4.1: Create Sound Detail Page
**File:** `src/app/sound/[soundId]/page.tsx` (new file)

Create a page component following the hashtag detail page pattern (`src/app/hashtag/[tag]/page.tsx`).

**Features:**
1. **Header Section**
   - Sound title (from `sound_title`)
   - Sound author (from `sound_author`)
   - Cover image (from `cover_url`)
   - Stats grid: Total Views, Videos, Creators count
   - Trending badge based on views

2. **Filter Bar**
   - Search input (search titles, creators)
   - Sort dropdown (views, recent, likes, trending)
   - Time range filter (all, 24h, 7d, 30d, 1y)

3. **Main Content Area (2-column layout)**
   - **Left Column (flex-1):** Videos grid
     - Show all videos using this sound
     - Pagination/infinite scroll support
     - Empty state when no videos
   - **Right Column (w-80, hidden xl:block):** Top Creators sidebar
     - Ranked list of creators
     - Shows: rank #, avatar, name, video count, total views
     - Clickable to navigate to creator profile

4. **Mobile Layout**
   - Stack creators below videos for xl:hidden
   - Same functionality, different layout

**Key Dependencies:**
- Import `useSoundVideos`, `useSoundCreators` hooks
- Use `VideoCard`, `CreatorCard` components
- Use `FilterBar` with `VIDEO_SORT_OPTIONS`
- Use empty state components

#### Task 4.2: Update SoundCard Component to Link to Detail Page
**File:** `src/app/components/SoundCard.tsx`

Add a link to navigate to the sound detail page when clicking on a sound card.

```typescript
<Link href={`/sound/${sound.id}`}>
  {/* existing card content */}
</Link>
```

---

### Phase 5: Data Accuracy Fixes

#### Task 5.1: Investigate Zero Video Counts
**File:** Investigate and create fix script

**Diagnosis Steps:**
1. Run query to check if `video_sound_facts` has data:
   ```sql
   SELECT s.sound_id, s.sound_title, s.videos_count, COUNT(vsf.video_id) as actual_count
   FROM sounds_hot s
   LEFT JOIN video_sound_facts vsf ON s.sound_id = vsf.sound_id
   GROUP BY s.sound_id
   ORDER BY actual_count DESC
   LIMIT 20;
   ```

2. Check if `sound_id` extraction is working in ingestion:
   - Look at sample JSON from BrightData
   - Verify extraction logic in `ingest_brightdata_snapshot_v2`

3. Verify aggregation is running:
   - Check if `update_sound_aggregates()` exists
   - Schedule to run periodically

**Potential Issues & Fixes:**
- If `sound_id` is NULL in ingestion: Fix extraction logic
- If `video_sound_facts` is empty: Re-ingest videos or backfill
- If aggregation not running: Add to scheduler/cron job

#### Task 5.2: Add Data Validation
**File:** Add to ingestion or aggregation

Ensure that every time a video is ingested or updated:
1. `sound_id` is extracted and normalized
2. `video_sound_facts` relationship is created/updated
3. Sound aggregates (`views_total`, `videos_count`) are updated
4. Timestamps (`first_used_at`, `last_used_at`) are maintained

---

### Phase 6: Testing & Validation

#### Task 6.1: Manual Testing Checklist
- [ ] Navigate to `/sounds` - verify accurate video counts
- [ ] Click on a sound card - navigate to `/sound/[soundId]`
- [ ] Verify sound header shows correct title, author, stats
- [ ] Test search filter on videos
- [ ] Test sort options (views, recent, likes)
- [ ] Test time range filter
- [ ] Verify top creators sidebar shows ranked list
- [ ] Click on creator in sidebar - navigate to creator profile
- [ ] Test on mobile/tablet - verify responsive layout
- [ ] Check empty states when no videos or creators

#### Task 6.2: Data Integrity Testing
- [ ] Verify video counts match actual count from `video_sound_facts`
- [ ] Verify total views in header match sum from videos
- [ ] Verify triggered sound aggregates update when new video ingested
- [ ] Test with sound that has 0 videos (edge case)

#### Task 6.3: Performance Testing
- [ ] Test page load with sound that has many videos (1000+)
- [ ] Verify pagination works correctly
- [ ] Check query performance on sound creators API
- [ ] Ensure indexes are being used effectively

---

## Implementation Order

### Step 1: Quick Wins (1-2 hours)
1. Create SQL function `get_sound_creators`
2. Create backfill script for video counts
3. Run backfill to fix existing data

### Step 2: Backend APIs (2-3 hours)
1. Create `/api/sounds/[soundId]/videos/route.ts`
2. Create `/api/sounds/[soundId]/creators/route.ts`
3. Test APIs independently with Postman/curl

### Step 3: Frontend Hooks (30 min)
1. Add `useSoundVideos` hook
2. Add `useSoundCreators` hook
3. Add `SoundCreator` type

### Step 4: UI Implementation (3-4 hours)
1. Create sound detail page component
2. Update SoundCard to link to detail page
3. Test responsive layout

### Step 5: Data Fixes & Validation (1-2 hours)
1. Investigate zero counts
2. Fix ingestion if needed
3. Add validation/logging

### Step 6: Testing & Polish (1-2 hours)
1. Manual testing
2. Fix edge cases
3. Performance optimization

**Total Estimated Time: 8-13 hours**

---

## Database Schema Reference

### sounds_hot
```sql
sound_id TEXT PRIMARY KEY
sound_title TEXT NOT NULL
sound_author TEXT
music_url TEXT
music_duration INTEGER
music_is_original BOOLEAN
cover_url TEXT
music_play_url TEXT
views_total BIGINT DEFAULT 0
videos_count INTEGER DEFAULT 0
likes_total BIGINT DEFAULT 0
first_used_at TIMESTAMP
last_used_at TIMESTAMP
updated_at TIMESTAMP
```

### video_sound_facts
```sql
id UUID PRIMARY KEY
video_id TEXT REFERENCES videos_hot(video_id)
sound_id TEXT REFERENCES sounds_hot(sound_id)
snapshot_at TIMESTAMP
views_at_snapshot INTEGER
likes_at_snapshot INTEGER
comments_at_snapshot INTEGER
is_first_use BOOLEAN
created_at TIMESTAMP
UNIQUE(video_id, sound_id)
```

---

## Success Criteria

✅ Sound detail page displays at `/sound/[soundId]`  
✅ All videos using the sound are shown with proper pagination  
✅ Search and sort functionality works correctly  
✅ Top creators sidebar shows ranked list by sound-specific views  
✅ Creator counts are accurate  
✅ Video counts are accurate on main Sounds page  
✅ New videos automatically update sound aggregates  
✅ Page is responsive and mobile-friendly  
✅ Empty states display when appropriate  
✅ Navigation between pages works correctly  

---

## Files to Create/Modify

### New Files
- `sql/016_sound_functions.sql` - SQL helper functions
- `scripts/fix-sound-video-counts.sql` - Backfill script
- `src/app/api/sounds/[soundId]/videos/route.ts` - Videos API
- `src/app/api/sounds/[soundId]/creators/route.ts` - Creators API
- `src/app/sound/[soundId]/page.tsx` - Sound detail page

### Modified Files
- `src/app/hooks/useData.ts` - Add sound hooks
- `src/app/types/data.ts` - Add SoundCreator type
- `src/app/components/SoundCard.tsx` - Add link to detail page
- `sql/012_aggregation.sql` - Verify sound aggregation (if needed)
- `sql/011_ingestion_v2.sql` - Verify sound extraction (if needed)

---

## Notes

- This plan mirrors the existing hashtag detail page implementation for consistency
- The database schema is already in place - minimal schema changes needed
- Focus on query optimization for sounds with many videos
- Consider adding caching for popular sounds
- May need to handle edge cases like sounds with no videos gracefully

