# Hashtag Detail Page Update

## Goal

Update the hashtag detail page (`/hashtag/[tag]`) to correctly display all videos and rankings related to that hashtag, with proper filtering, sorting, and a top creators sidebar.

## Current State

- The hashtag detail page currently exists at `src/app/hashtag/[tag]/page.tsx`
- It displays videos that include the hashtag but without proper filtering, sorting, or view ranking
- It shows creators but not ranked by their total views for that hashtag
- Videos are stored in `videos_hot` table with `views_count` field
- Video-hashtag relationships are in `video_hashtag_facts` table

## Required Changes

### 1. Database/Backend Changes

#### 1.1 Create API Endpoint for Hashtag Videos (Optional but Recommended)
**File:** `src/app/api/hashtags/[tag]/videos/route.ts` (new file)

- Query `video_hashtag_facts` joined with `videos_hot` and `creators_hot`
- Filter by hashtag name
- Order by `views_count` (play_count) DESC by default
- Support search, sort, and time range filters
- Return videos with creator information

**Alternative:** Can extend existing `/api/videos` route to accept a hashtag filter parameter.

#### 1.2 Create API Endpoint for Top Creators by Hashtag
**File:** `src/app/api/hashtags/[tag]/creators/route.ts` (new file)

- Join `video_hashtag_facts` with `videos_hot` and `creators_hot`
- Filter by hashtag
- Group by creator and SUM `views_count` to get total views per creator
- Order by total views DESC
- Return ranked creators with their total view count for that hashtag

### 2. Frontend Changes

#### 2.1 Update Hashtag Page Layout
**File:** `src/app/hashtag/[tag]/page.tsx`

**Changes needed:**

1. **Add Filter Bar Section**
   - Import `FilterBar` from `../components/filters`
   - Import `VIDEOF_SORT_OPTIONS` from filters
   - Add state for `searchQuery`, `sortBy`, `timeRange` (same as Edits page)
   - Add FilterBar component between header and content sections
   - Apply filters to the video list

2. **Update Video Sorting**
   - Currently no sorting is applied
   - Sort videos by `views` (mapped from `views_count`) in descending order by default
   - Apply same sorting logic as Edits page (views, recent, likes, trending)

3. **Add Two-Column Layout**
   - Change from single column to two-column layout (similar to creator detail page)
   - Left column: Video grid (main content)
   - Right column: Top Creators sidebar (fixed width ~300-350px)

4. **Update Creator Calculation**
   - Currently filters creators client-side but doesn't rank them
   - Calculate total views per creator by summing `views_count` of all their videos with this hashtag
   - Sort creators by total views DESC
   - Display in sidebar with their total view count

#### 2.2 Create/Update Data Fetching Hook
**File:** `src/app/hooks/useData.ts` (may need to create new hook or extend existing)

**Option A:** Extend existing hooks to accept hashtag filter

**Option B:** Create new hooks:
- `useHashtagVideos(tag, search, sort, timeRange)` - fetch videos for a hashtag
- `useHashtagCreators(tag)` - fetch top creators for a hashtag

#### 2.3 Verify Data Structure
**File:** `src/app/types/data.ts`

- Ensure `Video` interface includes all needed fields
- Verify `views` is being mapped from `views_count` correctly
- May need to add `play_count` or alias if needed

### 3. Implementation Steps

#### Step 1: Database Query Analysis
1. Verify the `video_hashtag_facts` table has all necessary fields
2. Test SQL query to fetch videos by hashtag, ordered by views_count DESC
3. Test SQL query to calculate total views per creator for a hashtag

**Sample SQL for videos by hashtag:**
```sql
SELECT 
  v.video_id,
  v.views_count,
  v.caption,
  v.cover_url,
  v.video_url,
  v.created_at,
  v.creator_id,
  c.username,
  c.avatar_url,
  c.verified
FROM video_hashtag_facts vhf
JOIN videos_hot v ON vhf.video_id = v.video_id
JOIN creators_hot c ON v.creator_id = c.creator_id
WHERE vhf.hashtag = 'edit'
ORDER BY v.views_count DESC;
```

**Sample SQL for top creators:**
```sql
SELECT 
  c.creator_id,
  c.username,
  c.display_name,
  c.avatar_url,
  c.verified,
  SUM(v.views_count) as total_views
FROM video_hashtag_facts vhf
JOIN videos_hot v ON vhf.video_id = v.video_id
JOIN creators_hot c ON v.creator_id = c.creator_id
WHERE vhf.hashtag = 'edit'
GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified
ORDER BY total_views DESC
LIMIT 10;
```

#### Step 2: Backend API Implementation
1. Create or update API route to fetch hashtag videos with filters
2. Create API route to fetch top creators for a hashtag
3. Test endpoints with sample hashtag
4. Verify response format matches frontend expectations

#### Step 3: Frontend State Management
1. Add filter state variables to hashtag page component
2. Add `useMemo` for filtering/sorting videos (similar to Edits page)
3. Update video display to use filtered/sorted data

#### Step 4: Layout Updates
1. Update page structure to two-column layout
2. Position top creators sidebar on the right
3. Make sidebar sticky/fixed if desired
4. Ensure responsive behavior (mobile: stack vertically)

#### Step 5: Creator Ranking Implementation
1. Calculate total views per creator for the hashtag
2. Sort creators by total views DESC
3. Display in sidebar with view count
4. Add loading state and error handling

#### Step 6: Integration & Testing
1. Test with various hashtags
2. Test filter functionality (search, sort, time range)
3. Test responsive layout
4. Verify view counts are correct
5. Check creator ranking accuracy

### 4. Files to Modify

#### Backend Files
- `src/app/api/hashtags/[tag]/videos/route.ts` (NEW - optional)
- `src/app/api/hashtags/[tag]/creators/route.ts` (NEW)
- OR extend `src/app/api/videos/route.ts` to accept hashtag parameter
- OR extend `src/app/api/hashtags/route.ts` to include video/creator data

#### Frontend Files
- `src/app/hashtag/[tag]/page.tsx` (MAIN FILE - extensive changes)
- `src/app/hooks/useData.ts` (may need new hooks)
- `src/app/types/data.ts` (verify/update types if needed)

#### Components (Reuse Existing)
- `src/app/components/filters/FilterBar.tsx` (already exists)
- `src/app/components/filters/SortDropdown.tsx` (already exists)
- `src/app/components/filters/TimeRangeFilter.tsx` (already exists)
- `src/app/components/VideoCard.tsx` (already exists)
- `src/app/components/CreatorCard.tsx` (already exists)

### 5. Key Implementation Details

#### Video Display
- **Ranking:** Order by `views_count` (play_count) DESC by default
- **Filters:** Search bar (title, creator, hashtags), sort dropdown, time range
- **Layout:** Grid layout matching Edits page (responsive columns)
- **Data Source:** `video_hashtag_facts` → `videos_hot` → `creators_hot`

#### Creator Sidebar
- **Calculation:** SUM of all video `views_count` for each creator within the hashtag
- **Ranking:** Order by total views DESC
- **Display:** Top 10-15 creators
- **Layout:** Fixed width sidebar (right side on desktop, stack on mobile)

#### Filter Logic
- **Search:** Filter by video title, creator username, or hashtags
- **Sort Options:** Views (desc), Recent, Likes (desc), Trending
- **Time Range:** 24h, 7d, 30d, 1y, All
- All filters should work together

### 6. Testing Checklist

- [ ] Videos display correctly for a hashtag
- [ ] Videos are ranked by view count (descending)
- [ ] Search filter works
- [ ] Sort filter works (views, recent, likes, trending)
- [ ] Time range filter works
- [ ] Top creators sidebar displays correctly
- [ ] Creator rankings are accurate (verify totals)
- [ ] Responsive layout works (mobile, tablet, desktop)
- [ ] Loading states work properly
- [ ] Error handling works for non-existent hashtags
- [ ] Empty states display when no videos/creators found
- [ ] Page title/SEO metadata is correct

### 7. Considerations

#### Performance
- Consider pagination for large hashtags (100+ videos)
- Cache API responses where appropriate
- Optimize database queries with proper indexes

#### Data Accuracy
- Ensure `views_count` field is populated correctly from ingestion
- Verify `video_hashtag_facts` has all relationships
- Check that hashtag normalization is consistent

#### UX
- Show loading skeletons while data loads
- Provide clear empty states
- Indicate when filters are active
- Make sidebar collapsible on mobile if needed

### 8. Estimated Work

**Backend:** 2-4 hours
- API route creation/testing
- Database query optimization
- Data transformation

**Frontend:** 4-6 hours
- Component refactoring
- Layout implementation
- Filter/sort logic
- Sidebar creation
- Responsive design

**Testing:** 2-3 hours
- Manual testing
- Bug fixes
- Edge cases

**Total:** 8-13 hours

---

## Quick Start Implementation Order

1. **First:** Update `hashtag/[tag]/page.tsx` to add filter bar and sorting logic
2. **Second:** Implement two-column layout with sidebar
3. **Third:** Calculate and display top creators with total views
4. **Fourth:** Create backend API routes if needed (or extend existing)
5. **Fifth:** Test thoroughly and fix any issues
6. **Sixth:** Optimize and add final polish

