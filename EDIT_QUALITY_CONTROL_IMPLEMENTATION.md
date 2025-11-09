# Edit Quality Control Implementation Guide

## Overview

This document outlines how to implement a quality-control system to ensure only TikTok videos with "edit" in their hashtags are saved to the database. Non-edit videos will be automatically rejected and recorded in a `rejected_videos` table.

## Architecture

- **Ingestion Point**: `ingest_brightdata_snapshot_v2()` PostgreSQL function (sql/011_ingestion_v2.sql)
- **Hashtag Processing**: Lines 239-272 in the ingestion function
- **Webhook Handler**: src/app/api/brightdata/webhook/route.ts
- **Frontend Input**: User pastes TikTok URLs (standardize before validation)

---

## Implementation Steps

### 1. Create Rejected Videos Table

**File**: `sql/014_rejected_videos.sql`

```sql
-- Rejected Videos Table
-- Stores videos that were rejected due to missing "edit" hashtag

CREATE TABLE IF NOT EXISTS rejected_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tiktok_url TEXT NOT NULL,
  standardized_url TEXT NOT NULL UNIQUE,
  rejection_reason TEXT DEFAULT 'No "edit" hashtag found',
  original_data JSONB,
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  post_id TEXT,
  creator_id TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rejected_videos_standardized_url 
  ON rejected_videos(standardized_url);

-- Index for checking by post_id
CREATE INDEX IF NOT EXISTS idx_rejected_videos_post_id 
  ON rejected_videos(post_id);

COMMENT ON TABLE rejected_videos IS 'Videos rejected for not containing "edit" in hashtags';
```

---

### 2. Create URL Standardization Function

**File**: `src/lib/url-utils.ts` (new file)

```typescript
/**
 * Standardizes TikTok URLs to a consistent format
 * Handles mobile/desktop variations, tracking params, etc.
 */
export function standardizeTikTokUrl(url: string): string {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Extract the video path (e.g., /@username/video/1234567890)
    const pathMatch = urlObj.pathname.match(/\/(@[\w\.]+)\/video\/(\d+)/);
    
    if (!pathMatch) {
      // If no match, return the original URL cleaned
      return url.split('?')[0];
    }
    
    const [_, username, videoId] = pathMatch;
    
    // Build standardized URL: https://www.tiktok.com/@username/video/videoId
    return `https://www.tiktok.com/${username}/video/${videoId}`;
  } catch (error) {
    // If parsing fails, try basic cleanup
    return url.split('?')[0].trim();
  }
}

/**
 * Checks if a TikTok URL contains a video ID pattern
 */
export function isValidTikTokUrl(url: string): boolean {
  return /tiktok\.com\/.+\/video\/\d+/.test(url);
}
```

---

### 3. Add Hashtag Validation Logic to Ingestion Function

**File**: `sql/011_ingestion_v2.sql`

**Modify the function** to include hashtag validation before processing. Add this logic after extracting the post_id (around line 60):

```sql
-- =======================================================================
-- EDIT HASHTAG VALIDATION
-- =======================================================================
-- Extract and check hashtags for "edit" keyword (case-insensitive)
DECLARE
  v_has_edit_hashtag BOOLEAN := FALSE;
  v_hashtag_check TEXT;
BEGIN
  -- Loop through hashtags to check for "edit"
  FOR v_hashtag_check IN 
    SELECT value::TEXT 
    FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]邮::JSONB))
  LOOP
    v_hashtag_check := LOWER(REPLACE(v_hashtag_check, '#', ''));
    
    -- Check if hashtag contains "edit" (case-insensitive, partial match)
    IF v_hashtag_check LIKE '%edit%' THEN
      v_has_edit_hashtag := TRUE;
      EXIT;  -- Found one, no need to check further
    END IF;
  END LOOP;
  
  -- If no "edit" hashtag found, reject and skip processing
  IF NOT v_has_edit_hashtag THEN
    -- Get standardized URL
    DECLARE
      v_url TEXT := v_element->>'url';
      v_standardized_url TEXT;
    BEGIN
      -- Basic standardization in SQL (extract video ID path)
      v_standardized_url := regexp_replace(
        v_url,
        '([\?&].*)?$',
        '',
        'g'
      );
      
      -- Store rejected video
      INSERT INTO rejected_videos (
        tiktok_url,
        standardized_url,
        rejection_reason,
        original_data,
        post_id,
        creator_id
      )
      VALUES (
        v_url,
        v_standardized_url,
        'No "edit" hashtag found',
        v_element,
        v_post_id,
        v_creator_id
      )
      ON CONFLICT (standardized_url) DO NOTHING;
      
      -- Skip to next video
      RAISE NOTICE 'Rejected video % - no edit hashtag', v_post_id;
      CONTINUE;
    END;
  END IF;
END;
```

**IMPORTANT**: This validation block should be placed **after** extracting `v_post_id` and `v_creator_id` (after line 61) but **before** any INSERT operations to the main tables.

---

### 4. Add Duplicate Prevention Check

In the same ingestion function, add a check at the beginning of the loop (right after extracting IDs, around line 62):

```sql
-- =======================================================================
-- DUPLICATE PREVENTION - Check Rejected Videos
-- =======================================================================
DECLARE
  v_video_url TEXT := v_element->>'url';
  v_standardized_url TEXT;
  v_is_already_rejected BOOLEAN := FALSE;
BEGIN
  -- Standardize URL
  v_standardized_url := regexp_replace(
    v_video_url,
    '([\?&].*)?$',
    '',
    'g'
  );
  
  -- Check if already rejected
  SELECT EXISTS (
    SELECT 1 FROM rejected_videos 
    WHERE standardized_url = v_standardized_url
  ) INTO v_is_already_rejected;
  
  IF v_is_already_rejected THEN
    RAISE NOTICE 'Video % already rejected, skipping', v_post_id;
    CONTINUE;
  END IF;
END;
```

---

### 5. Add Frontend URL Standardization

**File**: `src/app/components/SearchInput.tsx` (or wherever URL input is handled)

Add URL standardization when user pastes a TikTok URL:

```typescript
import { standardizeTikTokUrl, isValidTikTokUrl } from '@/lib/url-utils';

// In your input handler
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  
  // If it's a TikTok URL, standardize it
  if (value.includes('tiktok.com')) {
    const standardized = standardizeTikTokUrl(value);
    
    // Update input with standardized URL
    if (standardized !== value) {
      // Optionally show a message that URL was standardized
      console.log('URL standardized:', standardized);
    }
    
    setInputValue(standardized);
  } else {
    setInputValue(value);
  }
};
```

---

### 6. Add Pre-Ingestion Validation in Webhook Handler (Optional Enhancement)

**File**: `src/app/api/brightdata/webhook/route.ts`

For an extra layer of validation, add a pre-check before calling the RPC function:

```typescript
// Add this helper function at the top of the file
function hasEditHashtag(videoData: any): boolean {
  const hashtags = videoData.hashtags || [];
  return hashtags.some((tag: string) => 
    tag.toLowerCase().replace('#', '').includes('edit')
  );
}

// In the processWebhookData function, before calling the RPC:
const filteredPayload = payload.filter((video: any) => {
  if (!hasEditHashtag(video)) {
    console.log('Rejecting video for missing edit hashtag:', video.url);
    // Optionally log to rejected_videos table here via direct insert
    return false;
  }
  return true;
});

// Then call RPC with filtered payload
const { data, error } = await supabaseAdmin.rpc('ingest_brightdata_snapshot_v2', {
  p_snapshot_id: snapshot_id,
  p_dataset_id: dataset_id || '',
  p_payload: filteredPayload  // Use filtered payload
});
```

---

## Testing Strategy

### 1. Test URL Standardization

```typescript
// tests/url-utils.test.ts
import { standardizeTikTokUrl } from '@/lib/url-utils';

const testCases = [
  {
    input: 'https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1',
    expected: 'https://www.tiktok.com/@user/video/1234567890'
  },
  {
    input: 'https://vm.tiktok.com/ZMJqBdK/',
    // These shortened URLs would need API expansion first
  }
];
```

### 2. Test Hashtag Validation

```sql
-- Test SQL validation
SELECT 
  ingest_brightdata_snapshot_v2(
    'test_snapshot',
    'test_dataset',
    '[
      {
        "post_id": "test1",
        "profile_id": "creator1",
        "url": "https://www.tiktok.com/@user/video/123",
        "hashtags": ["#edit", "#creededit", "#nba"]
      },
      {
        "post_id": "test2", 
        "profile_id": "creator2",
        "url": "https://www.tiktok.com/@user/video/456",
        "hashtags": ["#comedy", "#funny", "#viral"]
      }
    ]'::jsonb
  );
  
-- Check results
SELECT * FROM rejected_videos;
SELECT * FROM videos_hot WHERE video_id IN ('test1', 'test2');
```

### 3. Test Duplicate Prevention

```sql
-- Insert a rejected video
INSERT INTO rejected_videos (standardized_url, tiktok_url, post_id, rejection_reason)
VALUES ('https://www.tiktok.com/@user/video/789', 'https://www.tiktok.com/@user/video/789?some=param', 'post789', 'test');

-- Try to ingest the same video
SELECT ingest_brightdata_snapshot_v2(
  'test_snapshot_2',
  'test_dataset',
  '[{"post_id": "post789", "profile_id": "creator1", "url": "https://www.tiktok.com/@user/video/789", "hashtags": ["#edit"]}]'::jsonb
);

-- Verify it was rejected again (check rejected_videos table for multiple entries or skip)
```

---

## Migration Steps

1. **Run SQL Script**: Execute `sql/014_rejected_videos.sql` to create the table
2. **Update Ingestion Function**: Modify `sql/011_ingestion_v2.sql.Schema with the validation logic`
3. **Deploy URL Utils**: Create `src/lib/url-utils.ts` with standardization functions
4. **Update Frontend**: Add URL standardization to input handlers
5. **Optional**: Add pre-validation in webhook handler
6. **Test**: Run test cases to verify functionality

---

## Monitoring & Maintenance

### Queries for Monitoring Rejected Videos

```sql
-- Count rejected videos by reason
SELECT rejection_reason, COUNT(*) 
FROM rejected_videos 
GROUP BY rejection_reason;

-- Recent rejections
SELECT * FROM rejected_videos 
ORDER BY rejected_at DESC 
LIMIT 50;

-- Check if any legitimate videos were rejected
SELECT COUNT(*) 
FROM rejected_videos 
WHERE rejection_reason LIKE '%edit%';
```

### Cleanup Old Rejected Videos (Optional)

```sql
-- Delete rejected videos older than 30 days
DELETE FROM rejected_videos 
WHERE rejected_at < NOW() - INTERVAL '30 days';
```

---

## Rollback Plan

If you need to disable the validation temporarily:

```sql
-- Create a new version of the ingestion function without validation
CREATE OR REPLACE FUNCTION ingest_brightdata_snapshot_v2_no_filter(...)
-- Same logic but without hashtag check

-- Or comment out the validation block in the existing function
```

---

## Edge Cases to Consider

1. **Empty Hashtags Array**: Currently treated as rejection (no "edit" found)
2. **Shortened URLs (vm.tiktok.com)**: May need expansion before standardization
3. **Multiple Variations**: Same video with different URL formats
4. **Performance**: Consider indexing on `standardized_url` for large rejection tables
5. **Partial "edit" matches**: "edited", "editing", "editor" all pass (current implementation)

---

## End Result

After implementation:
- ✅ Only videos with "edit" in hashtags are stored in `videos_hot`
- ✅ Rejected videos are recorded in `rejected_videos` table
- ✅ Duplicate submissions of rejected videos are prevented
- ✅ TikTok URLs are standardized to a consistent format
- ✅ Frontend provides immediate URL standardization feedback

