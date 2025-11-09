# Hashtag Detail Page Development Plan

## Executive Summary

This development plan outlines the complete implementation strategy to update the hashtag detail page (`/hashtag/[tag]`) to display all videos related to a specific hashtag with proper filtering, sorting, and a ranked creators sidebar.

**Goal**: When users visit `/hashtag/[name]`, they see:
1. All videos containing that hashtag, sortable and searchable
2. A sidebar showing creators ranked by total hashtag-specific views

---

## Current State Assessment

### ✅ Already Implemented
- Hashtag detail page structure exists at `src/app/hashtag/[tag]/page.tsx`
- Basic filtering and sorting UI components
- Top creators sidebar with basic rankings
- Video display with proper cards
- Responsive layout with mobile support

### ⚠️ Issues Identified
1. **Performance**: Currently fetches ALL videos and filters client-side (inefficient for large datasets)
2. **Data Source**: Videos API doesn't support hashtag filtering
3. **Creators Sidebar**: Shows creator rankings but doesn't display video count
4. **Data Accuracy**: May not be using the most efficient database queries

### 🗂️ Database Structure
- ✅ `videos_hot` table with `views_count` field
- ✅ `video_hashtag_facts` table tracking video-hashtag relationships
- ✅ `creators_hot` table with creator data
- ✅ `hashtags_hot` table with hashtag metadata

---

## Development Phases

### Phase 1: Backend API Development (2-3 hours)

#### 1.1 Create Hashtag-Specific API Endpoint
**New File**: `src/app/api/hashtags/[tag]/videos/route.ts`

**Purpose**: Fetch videos for a specific hashtag with proper joins and filtering

**Key Features**:
- Query using `video_hashtag_facts` joined with `videos_hot` and `creators_hot`
- Filter by hashtag name (normalized)
- Support search, sort, and time range parameters
- Return properly formatted video data

**SQL Query Structure**:
```sql
SELECT 
  v.video_id,
  v.post_id,
  v.creator_id,
  v.caption,
  v.description,
  v.views_count,
  v.likes_count,
  v.comments_count,
  v.shares_count,
  v.duration_seconds,
  v.created_at,
  v.cover_url,
  v.video_url,
  c.username,
  c.display_name,
  c.avatar_url,
  c.verified
FROM video_hashtag_facts vhf
JOIN videos_hot v ON vhf.video_id = v.video_id
JOIN creators_hot c ON v.creator_id = c.creator_id
WHERE vhf.hashtag = $1  -- normalized hashtag name
ORDER BY v.views_count DESC;
```

**API Endpoint Signature**:
```typescript
GET /api/hashtags/[tag]/videos?search=&sort=views&timeRange=all&limit=100&offset=0
```

#### 1.2 Create Top Creators API Endpoint
**New File**: `src/app/api/hashtags/[tag]/creators/route.ts`

**Purpose**: Fetch creators ranked by total views for videos with a specific hashtag

**Key Features**:
- Aggregate view counts per creator for the hashtag
- Include video count for each creator
- Sort by total views descending
- Limit to top 10-15 creators

**SQL Query Structure**:
```sql
SELECT 
  c.creator_id,
  c.username,
  c.display_name,
  c.avatar_url,
  c.verified,
  c.bio,
  SUM(v.views_count) as total_views,
  COUNT(DISTINCT v.video_id) as video_count
FROM video_hashtag_facts vhf
JOIN videos_hot v ON vhf.video_id = v.video_id
JOIN creators_hot c ON v.creator_id = c.creator_id
WHERE vhf.hashtag = $1  -- normalized hashtag name
GROUP BY c.creator_id, c.username, c.display_name, c.avatar_url, c.verified, c.bio
ORDER BY total_views DESC
LIMIT 15;
```

**API Endpoint Signature**:
```typescript
GET /api/hashtags/[tag]/creators
```

#### 1.3 Create Custom Data Hook
**Update File**: `src/app/hooks/useData.ts`

**Add new hooks**:
```typescript
export function useHashtagVideos(
  tag: string, 
  search = '', 
  sortBy = 'views', 
  timeRange = 'all',
  limit = 100
) {
  // Fetch videos for specific hashtag
}

export function useHashtagCreators(tag: string) {
  // Fetch top creators for specific hashtag
}
```

---

### Phase 2: Frontend Component Updates (3-4 hours)

#### 2.1 Update Hashtag Page Component
**File**: `src/app/hashtag/[tag]/page.tsx`

**Changes Required**:

1. **Replace Data Fetching**:
   - Current: `useVideos('', 100)` - fetches all videos
   - New: `useHashtagVideos(decodedTag, searchQuery, sortBy, timeRange)`

2. **Add Hashtag Creators Hook**:
   ```typescript
   const { data: topCreators, loading: loadingCreators } = useHashtagCreators(decodedTag);
   ```

3. **Remove Client-Side Filtering**:
   - Delete `tagVideosBase` filtering logic (lines 34-38)
   - Delete `filteredVideos` useMemo (lines 41-101)
   - Use data directly from API with filters applied server-side

4. **Update Top Creators Display**:
   - Add video count to each creator entry
   - Format: "X videos • Y views" instead of just "Y views"

5. **Numbermatics**: Update the creator sidebar to show video count:
   ```typescript
   <p className="text-sm text-gray-500">
     {formatNumber(entry.videoCount)} videos • {formatNumber(entry.totalViews)} views
   </p>
   ```

#### 2.2 Component Structure After Update
```typescript
export default function HashtagPage() {
  // ... existing state ...
  
  // NEW: Hashtag-specific data fetching
  const { data: hashtagVideos, loading: loadingVideos } = useHashtagVideos(
    decodedTag, 
    searchQuery, 
    sortBy, 
    timeRange
  );
  
  const { data: topCreators, loading: loadingCreators } = useHashtagCreators(decodedTag);
  
  // REMOVED: Client-side filtering logic
  
  // Render components...
}
```

#### 2.3 Update Types
**File**: `src/app/types/data.ts`

**Add interface for hashtag creators**:
```typescript
export interface HashtagCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  bio: string;
  total_views: number;
  video_count: number;
}
```

---

### Phase 3: Database Verification & Optimization (1 hour)

#### 3.1 Verify Database Structure
Run verification scripts to ensure:
- `video_hashtag_facts` has proper indexes
- Hashtag names are normalized consistently
- `views_count` field is populated correctly

**Verification Query**:
```sql
-- Check if video_hashtag_facts has proper data
SELECT 
  vhf.hashtag,
  COUNT(DISTINCT vhf.video_id) as video_count,
  SUM(v.views_count) as total_views
FROM video_hashtag_facts vhf
JOIN videos_hot v ON vhf.video_id = v.video_id
GROUP BY vhf.hashtag
ORDER BY total_views DESC
LIMIT 10;
```

#### 3.2 Update Aggregation Functions
**File**: `sql/012_aggregation.sql`

Ensure hashtag aggregations are updated correctly:
- `videos_count` - count of videos per hashtag
- `views_total` - sum of views for videos with hashtag
- `creators_count` - count of unique creators using hashtag

---

### Phase 4: UI/UX Polish (1-2 hours)

#### 4.1 Enhance Creator Sidebar Display
**File**: `src/app/hashtag/[tag]/page.tsx` (lines 285-320)

**Current Display**:
```typescript
<p className="text-sm text-gray-500">
  {formatNumber(entry.totalViews)} views
</p>
```

**Updated Display**:
```typescript
<p className="text-sm text-gray-500">
  {formatNumber(entry.videoCount)} video{entry.videoCount !== 1 ? 's' : ''}
</p>
<p className="text-xs text-gray-400">
  {formatNumber(entry.totalViews)} total views
</p>
```

#### 4.2 Add Empty States
- Show message when no videos found for hashtag
- Show message when no creators found
- Add loading skeletons

#### 4.3 Responsive Design
- Ensure sidebar stacks properly on mobile
- Test filter bar on all screen sizes
- Verify video grid responsiveness

---

## Implementation Checklist

### Backend Tasks
- [ ] Create `src/app/api/hashtags/[tag]/videos/route.ts`
  - [ ] Implement hashtag filtering
  - [ ] Implement search functionality
  - [ ] Implement sorting options
  - [ ] Implement time range filtering
  - [ ] Return properly formatted data
  - [ ] Add error handling
  
- [ ] Create `src/app/api/hashtags/[tag]/creators/route.ts`
  - [ ] Implement aggregations
  - [ ] Calculate total views per creator
  - [ ] Count videos per creator
  - [ ] Return ranked creators
  - [ ] Add error handling

- [ ] Update `src/app/hooks/useData.ts`
  - [ ] Add `useHashtagVideos` hook
  - [ ] Add `useHashtagCreators` hook
  - [ ] Implement loading states
  - [ ] Implement error handling

### Frontend Tasks
- [ ] Update `src/app/hashtag/[tag]/page.tsx`
  - [ ] Replace data fetching with hashtag-specific hooks
  - [ ] Remove client-side filtering logic
  - [ ] Update top creators display to show video count
  - [ ] Update video display to use filtered data directly
  - [ ] Add proper loading states
  - [ ] Add error handling

- [ ] Update `src/app/types/data.ts`
  - [ ] Add `HashtagCreator` interface
  - [ ] Verify `Video` interface has all needed fields

### Database Tasks
- [ ] Run verification queries
- [ ] Check index performance
- [ ] Verify aggregation functions
- [ ] Test with sample data

### Testing Tasks
- [ ] Test with popular hashtags (e.g., #nba, #edit)
- [ ] Test with hashtags that have few videos
- [ ] Test search functionality
- [ ] Test all sort options
- [ ] Test time range filters
- [ ] Test responsive layout
- [ ] Test loading states
- [ ] Test error handling
- [ ] Verify creator rankings are correct
- [ ] Verify video counts are accurate

---

## Technical Specifications

### API Response Formats

#### Hashtag Videos Endpoint
```json
{
  "data": [
    {
      "id": "video_id",
      "postId": "post_id",
      "title": "Video Title",
      "description": "Description",
      "thumbnail": "cover_url",
      "videoUrl": "video_url",
      "creator": {
        "id": "creator_id",
        "username": "username",
        "avatar": "avatar_url",
        "verified": false
      },
      "views": 12345,
      "likes": 678,
      "comments": 90,
      "shares": 12,
      "duration": 30,
      "createdAt": "2024-01-01T00:00:00Z",
      "hashtags": ["hashtag1", "hashtag2"]
    }
  ],
  "total": 150
}
```

#### Hashtag Creators Endpoint
```json
{
  "data": [
    {
      "creator_id": "creator_id",
      "username": "username",
      "display_name": "Display Name",
      "avatar_url": "avatar_url",
      "verified": true,
      "bio": "Bio text",
      "total_views": 1000000,
      "video_count": 25
    }
  ]
}
```

### Hashtag Normalization

Ensure consistent hashtag matching:
- Convert to lowercase
- Remove `#` prefix
- Trim whitespace

Example transformation:
```
"#NBA" → "nba"
"  #Edit  " → "edit"
"FunnyMeme" → "funnymeme"
```

---

## Performance Considerations

### Pagination
For hashtags with many videos (>100), consider adding pagination:
- Use `limit` and `offset` parameters
- Load more videos on scroll
- Or implement page-based navigation

### Caching
- Cache API responses for popular hashtags
- Use Next.js static generation where possible
- Implement client-side caching with React Query or SWR

### Database Optimization
- Ensure indexes on `video_hashtag_facts.hashtag`
- Ensure indexes on `video_hashtag_facts.video_id`
- Monitor query performance
- Consider materialized views for popular hashtags

---

## Error Handling

### API Error Scenarios
1. **Hashtag not found**: Return 404 with helpful message
2. **No videos found**: Return empty array
3. **Database error**: Return 500 with error details
4. **Invalid parameters**: Return 400 with validation errors

### Frontend Error Scenarios
1. **API failure**: Show error message
2. **No videos**: Show empty state
3. **Loading**: Show skeleton loaders
4. **Network issues**: Retry automatically

---

## Success Criteria

### Functional Requirements
✅ All videos with hashtag are displayed  
✅ Videos sorted by views by default  
✅ Search filter works correctly  
✅ Sort filters work correctly (views, recent, likes, trending)  
✅ Time range filters work correctly  
✅ Creators sidebar shows correct rankings  
✅ Creator view counts are accurate  
✅ Creator video counts are displayed  
✅ Page is responsive on all devices  

### Performance Requirements
✅ Page loads in under 2 seconds  
✅ No visible lag when applying filters  
✅ Smooth scrolling on mobile  
✅ No memory leaks with filters  

### Data Quality Requirements
✅ View counts match database values  
✅ Creator rankings are correct  
✅ No duplicate videos  
✅ Proper handling of special characters in hashtags  

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| Phase 1 | Backend API Development | 2-3 hours |
| Phase 2 | Frontend Component Updates | 3-4 hours |
| Phase 3 | Database Verification | 1 hour |
| Phase 4 | UI/UX Polish | 1-2 hours |
| Testing | Manual Testing & Bug Fixes | 2-3 hours |
| **Total** | | **9-13 hours** |

---

## Quick Start Guide

### Step 1: Create API Endpoints
```bash
# Create directory structure
mkdir -p src/app/api/hashtags/[tag]

# Create video endpoint
touch src/app/api/hashtags/[tag]/videos/route.ts

# Create creators endpoint
touch src/app/api/hashtags/[tag]/creators/route.ts
```

### Step 2: Implement Backend Logic
- Write SQL queries for video filtering
- Write SQL queries for creator aggregation
- Implement API route handlers
- Test endpoints with Postman/curl

### Step 3: Update Frontend
- Add hooks to `useData.ts`
- Update hashtag page component
- Remove client-side filtering
- Update UI to show video counts

### Step 4: Test & Iterate
- Test with various hashtags
- Fix any issues
- Optimize performance
- Add final polish

---

## Next Steps After Completion

Once this implementation is complete, consider:

1. **Performance Enhancements**
   - Add pagination for large hashtags
   - Implement infinite scroll
   - Add caching layer

2. **Feature Enhancements**
   - Add related hashtags section
   - Add trending hashtags in sidebar
   - Add hashtag analytics

3. **SEO Improvements**
   - Add proper meta tags
   - Generate static pages for popular hashtags
   - Add hashtag descriptions

4. **Analytics**
   - Track hashtag page views
   - Track popular filters used
   - Monitor performance metrics

---

## Reference Files

### Files to Create
- `src/app/api/hashtags/[tag]/videos/route.ts`
- `src/app/api/hashtags/[tag]/creators/route.ts`

### Files to Modify
- `src/app/hashtag/[tag]/page.tsx`
- `src/app/hooks/useData.ts`
- `src/app/types/data.ts`

### Files to Review
- `sql/010_fact_tables.sql` - video_hashtag_facts schema
- `sql/011_ingestion_v2.sql` - data ingestion logic
- `sql/012_aggregation.sql` - aggregation functions
- `src/app/components/VideoCard.tsx` - video display component
- `src/app/edits/page.tsx` - reference for filter implementation

---

## Questions to Resolve Before Starting

1. Should we implement pagination now or later?
2. Do we need to populate `hashtags` array in video API response?
3. Should we cache API responses?
4. What's the maximum number of videos to display per page?
5. Should creator sidebar be collapsible on mobile?

---

## Notes

- This plan assumes the database structure is complete and data is being ingested correctly
- All times are estimates and may vary based on implementation details
- Focus on implementing core functionality first, then optimize
- Test thoroughly with real data before deployment

