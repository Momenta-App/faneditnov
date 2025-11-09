# Impact Score Implementation Plan

## Executive Summary

This plan adds a comment-weighted Impact Score to complement existing view-based rankings across videos, creators, hashtags, communities, and sounds.

**Formula**: `Impact = 100 × comments + 0.1 × shares + 0.001 × likes + views ÷ 100000 + 0.1 × saves`

**Scope**: Keep ALL existing views-based features unchanged (views remain default sort, all view counts and filters stay). Add Impact as an ADDITIONAL sort option and display metric alongside views.

---

## Important: What's NOT Changing

**Views Remain Unchanged**:
- ✅ View counts stay visible everywhere they currently display
- ✅ Sorting by views remains available in all dropdowns
- ✅ Views remain the default sort option
- ✅ View-based filtering stays exactly as is
- ✅ All `views_count`, `total_play_count`, `views_total` columns untouched
- ✅ Existing leaderboards by views continue working

**What We're Adding**:
- ➕ Impact Score as an ADDITIONAL sort option (not replacing views)
- ➕ Impact Score display ALONGSIDE view counts (both visible)
- ➕ Optional impact-based filtering (views filtering unchanged)
- ➕ New `impact_score` and `total_impact_score` columns (additive)

---

## Phase 1: Discovery - Current State

### 1a. Files and Modules for View-Based Ranking

**Database Schema (SQL)**
- `sql/006_hot_tables.sql` - Core metrics tables with views_count columns
- `sql/008_leaderboards.sql` - Precomputed rankings by time period
- `sql/012_aggregation.sql` - Aggregation functions that sum views
- `sql/013_add_play_counts.sql` - Creator total_play_count column
- `sql/016_sound_functions.sql` - Sound aggregation RPCs
- `sql/017_communities.sql` - Community aggregation functions

**API Endpoints (Sorting by Views)**
- `src/app/api/videos/route.ts` - Sorts by views_count (line 26)
- `src/app/api/creators/route.ts` - Sorts by total_play_count (line 16)
- `src/app/api/sounds/route.ts` - Sorts by views_total (line 16)
- `src/app/api/hashtags/route.ts` - Sorts by views_total (line 16)
- `src/app/api/communities/route.ts` - Sorts by total_views (line 25)
- `src/app/api/hashtags/[tag]/videos/route.ts` - Supports views sort (line 78-82)
- `src/app/api/sounds/[soundId]/videos/route.ts` - Supports views sort (line 74-90)
- `src/app/api/communities/[id]/videos/route.ts` - Sorts by views_count (line 67-71)
- `src/app/api/communities/[id]/creators/route.ts` - Sorts by total_views (line 15)
- `src/app/api/hashtags/[tag]/creators/route.ts` - Uses get_hashtag_creators RPC (line 16)

**Frontend Components**
- `src/app/components/filters/SortDropdown.tsx` - Sort options (VIDEO_SORT_OPTIONS, CREATOR_SORT_OPTIONS, HASHTAG_SORT_OPTIONS, SOUND_SORT_OPTIONS, COMMUNITY_SORT_OPTIONS)
- `src/app/edits/page.tsx` - Video list sorted by views (line 48)
- `src/app/hashtags/page.tsx` - Hashtag list sorted by views (line 33)
- `src/app/hashtag/[tag]/page.tsx` - Detail page with view counts

### 1b. Canonical Metrics Table

**Table**: `public.videos_hot` (sql/006_hot_tables.sql lines 57-80)

**Columns**:
- `views_count` INTEGER DEFAULT 0
- `likes_count` INTEGER DEFAULT 0
- `comments_count` INTEGER DEFAULT 0
- `shares_count` INTEGER DEFAULT 0
- `collect_count` INTEGER DEFAULT 0 (saves)

**Note**: `collect_count` is the saves column name in this schema.

### 1c. Denormalized/Rollup Tables

**Creators Aggregate**: `creators_hot`
- Columns: `total_play_count` (sum of video views), `likes_total`, `videos_count`
- Updated by: `update_aggregations()` function in sql/012_aggregation.sql

**Sounds Aggregate**: `sounds_hot`
- Columns: `views_total`, `likes_total`, `videos_count`
- Updated by: `update_aggregations()` function

**Hashtags Aggregate**: `hashtags_hot`
- Columns: `views_total`, `likes_total`, `videos_count`, `creators_count`, `trend_score`
- Updated by: `update_aggregations()` function

**Communities Aggregate**: `communities`
- Columns: `total_views`, `total_likes`, `total_videos`, `total_creators`
- Updated by: `update_community_totals()` function in sql/017_communities.sql

**Community Sub-Aggregates**:
- `community_creator_memberships` - Has `total_views` per creator per community
- `community_hashtag_memberships` - Has `total_views` per hashtag per community

### 1d. Endpoints and React Components for Views

**API Endpoints Supporting Sort**:
1. GET /api/videos - sortBy param (defaults to views)
2. GET /api/creators - sorts by total_play_count
3. GET /api/sounds - sorts by views_total
4. GET /api/hashtags - sorts by views_total
5. GET /api/communities - sort param (total_views, videos, creators)
6. GET /api/hashtags/[tag]/videos - sortBy param (views, likes, recent)
7. GET /api/sounds/[soundId]/videos - sortBy param (views, likes, recent, trending)
8. GET /api/communities/[id]/videos - sort param (views, likes, recent)
9. GET /api/communities/[id]/creators - sorts by total_views
10. GET /api/hashtags/[tag]/creators - uses RPC for aggregation

**Frontend Pages**:
- `/edits` - Video grid sorted by views
- `/hashtags` - Hashtag list sorted by views
- `/hashtag/[tag]` - Videos and creators by views
- `/sound/[id]` - Videos and creators by views
- `/community/[slug]` - Videos and creators by views
- `/creators` - Creator list sorted by total_play_count
- `/sounds` - Sound list sorted by views_total

### 1e. Backfill Approach

**Current Pattern**: Direct UPDATE statements on entire tables
- Example in sql/013_add_play_counts.sql lines 37-42
- Updates all rows in creators_hot by aggregating from videos_hot
- No explicit batching, relies on Postgres to handle large updates

**Batching Helpers**: None currently exist. Large updates run as single statements.

### 1f. Supabase Features in Use

**SQL Functions**: Yes
- `update_aggregations()` - Main aggregation function
- `update_community_totals()` - Community aggregation
- `get_sound_creators()`, `get_sound_stats()` - Sound RPCs
- `ingest_brightdata_snapshot_v2()` - Data ingestion

**Triggers**: Yes
- Auto-updating timestamps (updated_at columns)
- Hashtag normalization trigger

**pg_cron**: No pg_cron jobs found in schema files

**Scheduled Functions**: No Supabase Edge Functions scheduled jobs found

**Current Approach**: Manual or API-triggered aggregation updates

---

## Phase 2: Database Changes - Add Impact Score

### 2a. Add impact_score to videos_hot

```sql
-- sql/019_impact_score.sql

-- ============================================================================
-- PART 1: IMPACT SCORE COMPUTATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_impact(
  p_views INTEGER,
  p_likes INTEGER,
  p_comments INTEGER,
  p_shares INTEGER,
  p_saves INTEGER
) RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND(
    100.0 * COALESCE(p_comments, 0)
    + 0.1 * COALESCE(p_shares, 0)
    + 0.001 * COALESCE(p_likes, 0)
    + COALESCE(p_views, 0) / 100000.0
    + 0.1 * COALESCE(p_saves, 0)
  , 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.compute_impact IS 'Compute Impact Score: 100×comments + 0.1×shares + 0.001×likes + views/100k + 0.1×saves';

-- ============================================================================
-- PART 2: ADD COLUMNS TO videos_hot
-- ============================================================================

ALTER TABLE public.videos_hot
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMENT ON COLUMN videos_hot.impact_score IS 'Comment-weighted impact score for ranking';
COMMENT ON COLUMN videos_hot.impact_updated_at IS 'Timestamp of last impact score update';

-- ============================================================================
-- PART 3: TRIGGER TO AUTO-UPDATE IMPACT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.videos_set_impact() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.impact_score := public.compute_impact(
    NEW.views_count,
    NEW.likes_count,
    NEW.comments_count,
    NEW.shares_count,
    NEW.collect_count
  );
  NEW.impact_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_set_impact ON public.videos_hot;

CREATE TRIGGER trg_videos_set_impact
  BEFORE INSERT OR UPDATE OF views_count, likes_count, comments_count, shares_count, collect_count
  ON public.videos_hot
  FOR EACH ROW 
  EXECUTE FUNCTION public.videos_set_impact();

-- ============================================================================
-- PART 4: INDEXES FOR IMPACT SCORE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_videos_impact_score_desc 
  ON public.videos_hot(impact_score DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_videos_creator_impact 
  ON public.videos_hot(creator_id, impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_videos_created_impact 
  ON public.videos_hot(created_at DESC, impact_score DESC);
```

### 2b. Backfill Existing Videos

```sql
-- ============================================================================
-- BACKFILL: Update impact_score for all existing videos
-- Run AFTER the schema changes above
-- ============================================================================

-- One-time full backfill (can be slow on large tables)
UPDATE public.videos_hot
SET 
  impact_score = public.compute_impact(
    views_count, 
    likes_count, 
    comments_count, 
    shares_count, 
    collect_count
  ),
  impact_updated_at = NOW()
WHERE TRUE;

-- Verify backfill
SELECT 
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE impact_score > 0) as videos_with_impact,
  AVG(impact_score) as avg_impact,
  MAX(impact_score) as max_impact
FROM videos_hot;
```

**Batching Strategy** (if table is very large, >500k rows):

```sql
-- Batch by primary key ranges
DO $$
DECLARE
  batch_size INTEGER := 10000;
  offset_val INTEGER := 0;
  updated_count INTEGER;
BEGIN
  LOOP
    UPDATE videos_hot v
    SET 
      impact_score = compute_impact(views_count, likes_count, comments_count, shares_count, collect_count),
      impact_updated_at = NOW()
    WHERE v.video_id IN (
      SELECT video_id 
      FROM videos_hot 
      ORDER BY video_id 
      LIMIT batch_size 
      OFFSET offset_val
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    EXIT WHEN updated_count = 0;
    
    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Updated % videos, offset now %', updated_count, offset_val;
    
    -- Small delay to avoid locking issues
    PERFORM pg_sleep(0.5);
  END LOOP;
END $$;
```

**Alternative: Batch by created_at windows**:

```sql
-- Update in time-based chunks (e.g., by week)
DO $$
DECLARE
  start_date TIMESTAMP := '2020-01-01'::TIMESTAMP;
  end_date TIMESTAMP;
  chunk_days INTEGER := 7;
BEGIN
  LOOP
    end_date := start_date + (chunk_days || ' days')::INTERVAL;
    
    UPDATE videos_hot
    SET 
      impact_score = compute_impact(views_count, likes_count, comments_count, shares_count, collect_count),
      impact_updated_at = NOW()
    WHERE created_at >= start_date AND created_at < end_date;
    
    RAISE NOTICE 'Updated videos from % to %', start_date, end_date;
    
    start_date := end_date;
    EXIT WHEN start_date > NOW();
  END LOOP;
END $$;
```

---

## Phase 3: Aggregations for Creators, Hashtags, Sounds, Communities

### 3a. Add total_impact_score Columns

```sql
-- ============================================================================
-- ADD AGGREGATE COLUMNS
-- ============================================================================

-- Creators
ALTER TABLE public.creators_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creators_total_impact 
  ON public.creators_hot(total_impact_score DESC);

COMMENT ON COLUMN creators_hot.total_impact_score IS 'Sum of impact_score from all creator videos';

-- Sounds
ALTER TABLE public.sounds_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sounds_total_impact 
  ON public.sounds_hot(total_impact_score DESC);

-- Hashtags
ALTER TABLE public.hashtags_hot
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_hashtags_total_impact 
  ON public.hashtags_hot(total_impact_score DESC);

-- Communities
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_communities_total_impact 
  ON public.communities(total_impact_score DESC);

-- Community sub-tables
ALTER TABLE public.community_creator_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_creator_impact 
  ON public.community_creator_memberships(total_impact_score DESC);

ALTER TABLE public.community_hashtag_memberships
  ADD COLUMN IF NOT EXISTS total_impact_score NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_hashtag_impact 
  ON public.community_hashtag_memberships(total_impact_score DESC);
```

### 3b. Aggregation Approach

**Recommendation**: Use **trigger-based incremental counters** for real-time updates, with periodic reconciliation to fix drift.

**Why Not Materialized Views**:
- Require manual refresh
- Can become stale
- Refresh locks entire view

**Why Incremental Triggers**:
- Real-time updates as metrics change
- Minimal overhead per video update
- Existing trigger already fires on metric changes

### 3c. Update Aggregation Function

```sql
-- ============================================================================
-- EXTEND update_aggregations() TO INCLUDE IMPACT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregations() RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_result JSONB := '{}'::JSONB;
  v_creators_updated INTEGER := 0;
  v_sounds_updated INTEGER := 0;
  v_hashtags_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation update with impact scores...';

  -- =======================================================================
  -- UPDATE CREATOR COUNTS (INCLUDING IMPACT)
  -- =======================================================================
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
    total_impact_score = (
      SELECT COALESCE(SUM(impact_score), 0)
      FROM videos_hot v
      WHERE v.creator_id = c.creator_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM videos_hot v WHERE v.creator_id = c.creator_id
  );
  
  GET DIAGNOSTICS v_creators_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % creators', v_creators_updated;

  -- =======================================================================
  -- UPDATE SOUND COUNTS (INCLUDING IMPACT)
  -- =======================================================================
  UPDATE sounds_hot s
  SET 
    videos_count = (
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
    likes_total = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_sound_facts vsf
      JOIN videos_hot v ON v.video_id = vsf.video_id
      WHERE vsf.sound_id = s.sound_id
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_sound_facts vsf WHERE vsf.sound_id = s.sound_id
  );
  
  GET DIAGNOSTICS v_sounds_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % sounds', v_sounds_updated;

  -- =======================================================================
  -- UPDATE HASHTAG COUNTS (INCLUDING IMPACT)
  -- =======================================================================
  UPDATE hashtags_hot h
  SET 
    videos_count = (
      SELECT COUNT(DISTINCT video_id) 
      FROM video_hashtag_facts vhf 
      WHERE vhf.hashtag = h.hashtag
    ),
    creators_count = (
      SELECT COUNT(DISTINCT v.creator_id)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    views_total = (
      SELECT COALESCE(SUM(v.views_count), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    likes_total = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = h.hashtag
    ),
    trend_score = (
      CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 3600 THEN views_total * 10.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 86400 THEN views_total * 5.0
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen_at)) < 604800 THEN views_total * 2.0
        ELSE views_total * 1.0
      END
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM video_hashtag_facts vhf WHERE vhf.hashtag = h.hashtag
  );
  
  GET DIAGNOSTICS v_hashtags_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % hashtags', v_hashtags_updated;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'creators_updated', v_creators_updated,
    'sounds_updated', v_sounds_updated,
    'hashtags_updated', v_hashtags_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );

END;
$$ LANGUAGE plpgsql;
```

### 3d. Update Community Functions

```sql
-- ============================================================================
-- UPDATE update_community_totals TO INCLUDE IMPACT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_totals(p_community_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE communities
  SET 
    total_videos = (
      SELECT COUNT(DISTINCT video_id) 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    ),
    total_views = (
      SELECT COALESCE(SUM(v.views_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_creators = (
      SELECT COUNT(DISTINCT creator_id)
      FROM community_creator_memberships
      WHERE community_id = p_community_id AND video_count > 0
    ),
    total_likes = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    total_impact_score = (
      SELECT COALESCE(SUM(v.impact_score), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE recalculate_community_creator_memberships TO INCLUDE IMPACT
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_creator_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_creator_id TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
  v_first_video_at TIMESTAMP WITH TIME ZONE;
  v_last_video_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Delete all existing creator memberships for this community
  DELETE FROM community_creator_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community
  FOR v_creator_id IN 
    SELECT DISTINCT creator_id
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
  LOOP
    -- Count videos and sum metrics for this creator in this community
    SELECT 
      COUNT(*), 
      COALESCE(SUM(v.views_count), 0),
      COALESCE(SUM(v.impact_score), 0),
      MIN(v.created_at),
      MAX(v.created_at)
    INTO v_count, v_views, v_impact, v_first_video_at, v_last_video_at
    FROM community_video_memberships cvm
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND v.creator_id = v_creator_id;
    
    -- Insert the recalculated membership (only if count > 0)
    IF v_count > 0 THEN
      INSERT INTO community_creator_memberships (
        community_id, creator_id, video_count, total_views, total_impact_score,
        first_video_at, last_video_at, joined_at, last_updated
      )
      VALUES (p_community_id, v_creator_id, v_count, v_views, v_impact, v_first_video_at, v_last_video_at, NOW(), NOW());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE recalculate_community_hashtag_memberships TO INCLUDE IMPACT
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_community_hashtag_memberships(p_community_id UUID)
RETURNS void AS $$
DECLARE
  v_hashtag TEXT;
  v_count INTEGER;
  v_views BIGINT;
  v_impact NUMERIC;
BEGIN
  -- Delete all existing hashtag memberships for this community
  DELETE FROM community_hashtag_memberships WHERE community_id = p_community_id;
  
  -- Recalculate based on actual videos in the community, but only for hashtags in linked_hashtags
  FOR v_hashtag IN 
    SELECT DISTINCT vhf.hashtag
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag IN (SELECT UNNEST(linked_hashtags) FROM communities WHERE id = p_community_id)
  LOOP
    -- Count videos and sum metrics for this hashtag in this community
    SELECT COUNT(*), COALESCE(SUM(v.views_count), 0), COALESCE(SUM(v.impact_score), 0)
    INTO v_count, v_views, v_impact
    FROM community_video_memberships cvm
    JOIN video_hashtag_facts vhf ON vhf.video_id = cvm.video_id
    JOIN videos_hot v ON v.video_id = cvm.video_id
    WHERE cvm.community_id = p_community_id
      AND vhf.hashtag = v_hashtag;
    
    -- Insert the recalculated membership
    INSERT INTO community_hashtag_memberships (community_id, hashtag, video_count, total_views, total_impact_score, joined_at, last_updated)
    VALUES (p_community_id, v_hashtag, v_count, v_views, v_impact, NOW(), NOW());
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 3e. Backfill Aggregates

```sql
-- ============================================================================
-- BACKFILL AGGREGATE TOTALS
-- ============================================================================

-- Run the updated aggregation function
SELECT update_aggregations();

-- Backfill all communities
DO $$
DECLARE
  comm RECORD;
BEGIN
  FOR comm IN SELECT id FROM communities LOOP
    PERFORM update_community_totals(comm.id);
    PERFORM recalculate_community_creator_memberships(comm.id);
    PERFORM recalculate_community_hashtag_memberships(comm.id);
    RAISE NOTICE 'Updated community %', comm.id;
  END LOOP;
END $$;

-- Verify results
SELECT 
  'creators' as entity,
  COUNT(*) as total,
  AVG(total_impact_score) as avg_impact,
  MAX(total_impact_score) as max_impact
FROM creators_hot
UNION ALL
SELECT 
  'sounds',
  COUNT(*),
  AVG(total_impact_score),
  MAX(total_impact_score)
FROM sounds_hot
UNION ALL
SELECT 
  'hashtags',
  COUNT(*),
  AVG(total_impact_score),
  MAX(total_impact_score)
FROM hashtags_hot
UNION ALL
SELECT 
  'communities',
  COUNT(*),
  AVG(total_impact_score),
  MAX(total_impact_score)
FROM communities;
```

---

## Phase 4: Ongoing Updates

### 4a. Real-Time Updates

Impact scores are automatically maintained by the existing trigger on `videos_hot`. When metrics change, the trigger fires and recomputes impact_score.

### 4b. Scheduled Reconciliation

Create a reconciliation function to fix any drift:

```sql
-- ============================================================================
-- RECONCILIATION FUNCTION
-- Recomputes impact for recently updated videos and refreshes aggregates
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_impact_scores(p_days_back INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP := NOW();
  v_videos_updated INTEGER;
  v_cutoff TIMESTAMP := NOW() - (p_days_back || ' days')::INTERVAL;
BEGIN
  -- Recompute impact for recently updated videos
  UPDATE videos_hot
  SET 
    impact_score = compute_impact(views_count, likes_count, comments_count, shares_count, collect_count),
    impact_updated_at = NOW()
  WHERE updated_at >= v_cutoff;
  
  GET DIAGNOSTICS v_videos_updated = ROW_COUNT;
  
  -- Refresh aggregates
  PERFORM update_aggregations();
  
  RETURN jsonb_build_object(
    'success', true,
    'videos_reconciled', v_videos_updated,
    'duration_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql;
```

**Schedule with Supabase**: Create a Supabase Edge Function that calls this reconciliation function daily.

Create file: `supabase/functions/reconcile-impact/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('reconcile_impact_scores', { p_days_back: 7 });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Alternative: pg_cron** (if available):

```sql
-- If pg_cron extension is available
SELECT cron.schedule(
  'reconcile-impact-daily',
  '0 3 * * *',  -- Run at 3 AM daily
  $$SELECT reconcile_impact_scores(7)$$
);
```

---

## Phase 5: API and Server Code Changes

### 5a. Update Videos API

File: `src/app/api/videos/route.ts`

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const offset = parseInt(searchParams.get('offset') || '0') || 0;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default
    const impactMin = parseFloat(searchParams.get('impact_min') || '0');
    const impactMax = parseFloat(searchParams.get('impact_max') || '999999999');

    // Query from hot tables with join to creators
    let query = supabaseAdmin
      .from('videos_hot')
      .select(`
        *,
        creator:creators_hot!videos_hot_creator_id_fkey(
          creator_id,
          username,
          display_name,
          avatar_url,
          verified
        )
      `)
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Apply impact filters
    if (impactMin > 0) {
      query = query.gte('impact_score', impactMin);
    }
    if (impactMax < 999999999) {
      query = query.lte('impact_score', impactMax);
    }

    // Apply search filter
    if (search) {
      query = query.or(`caption.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('impact_score', { ascending: false });
        break;
      case 'views':
        query = query.order('views_count', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('impact_score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map((video: any) => ({
      id: video.video_id,
      postId: video.post_id,
      title: video.caption || video.description || 'Untitled',
      thumbnail: video.thumbnail_url || video.cover_url,
      duration: video.duration_seconds || 0,
      views: video.views_count || 0,
      likes: video.likes_count || 0,
      comments: video.comments_count || 0,
      shares: video.shares_count || 0,
      saves: video.collect_count || 0,
      impact: video.impact_score || 0, // Add impact to response
      createdAt: video.created_at,
      creator: video.creator ? {
        id: video.creator.creator_id,
        username: video.creator.username,
        displayName: video.creator.display_name || video.creator.username,
        avatar: video.creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator.display_name || video.creator.username)}&background=120F23&color=fff`,
        verified: video.creator.verified || false,
      } : null,
    })) || [];

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Error in videos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5b. Update Creators API

File: `src/app/api/creators/route.ts`

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default

    // Query directly from creators_hot table
    let query = supabaseAdmin
      .from('creators_hot')
      .select('*')
      .limit(limit);

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('total_impact_score', { ascending: false });
        break;
      case 'views':
        query = query.order('total_play_count', { ascending: false });
        break;
      case 'followers':
        query = query.order('followers_count', { ascending: false });
        break;
      case 'videos':
        query = query.order('videos_count', { ascending: false });
        break;
      default:
        query = query.order('total_impact_score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching creators:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const creators = data?.map((creator: any) => ({
      id: creator.creator_id,
      username: creator.username,
      displayName: creator.display_name || creator.username,
      bio: creator.bio || '',
      avatar: creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name || creator.username)}&background=120F23&color=fff`,
      verified: creator.verified || false,
      followers: creator.followers_count || 0,
      videos: creator.videos_count || 0,
      likes: creator.likes_total || 0,
      views: creator.total_play_count || 0,
      impact: creator.total_impact_score || 0, // Add impact
    })) || [];

    return NextResponse.json({ data: creators });
  } catch (error) {
    console.error('Error in creators API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5c. Update Sounds API

File: `src/app/api/sounds/route.ts`

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default

    // Query directly from sounds_hot table
    let query = supabaseAdmin
      .from('sounds_hot')
      .select('*')
      .limit(limit);

    if (search) {
      query = query.or(`sound_title.ilike.%${search}%,sound_author.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('total_impact_score', { ascending: false });
        break;
      case 'views':
        query = query.order('views_total', { ascending: false });
        break;
      case 'videos':
        query = query.order('videos_count', { ascending: false });
        break;
      case 'likes':
        query = query.order('likes_total', { ascending: false });
        break;
      case 'recent':
        query = query.order('last_used_at', { ascending: false });
        break;
      default:
        query = query.order('total_impact_score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sounds:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const sounds = data?.map((sound: any) => ({
      id: sound.sound_id,
      title: sound.sound_title,
      author: sound.sound_author || 'Unknown Artist',
      duration: sound.music_duration || 0,
      thumbnail: sound.cover_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sound.sound_title)}&background=6366f1&color=fff&size=128`,
      videos: sound.videos_count || 0,
      views: sound.views_total || 0,
      likes: sound.likes_total || 0,
      impact: sound.total_impact_score || 0, // Add impact
    })) || [];

    return NextResponse.json({ data: sounds });
  } catch (error) {
    console.error('Error in sounds API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5d. Update Hashtags API

File: `src/app/api/hashtags/route.ts`

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50') || 50;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views'; // Keep views as default

    // Query directly from hashtags_hot table
    let query = supabaseAdmin
      .from('hashtags_hot')
      .select('*')
      .limit(limit);

    if (search) {
      query = query.or(`hashtag.ilike.%${search}%,hashtag_norm.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'impact':
        query = query.order('total_impact_score', { ascending: false });
        break;
      case 'views':
        query = query.order('views_total', { ascending: false });
        break;
      case 'videos':
        query = query.order('videos_count', { ascending: false });
        break;
      case 'alphabetical':
        query = query.order('hashtag_norm', { ascending: true });
        break;
      default:
        query = query.order('total_impact_score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching hashtags:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match frontend expectations
    const hashtags = data?.map((hashtag: any) => ({
      id: hashtag.hashtag,
      name: hashtag.hashtag_norm || hashtag.hashtag,
      views: hashtag.views_total || 0,
      videos: hashtag.videos_count || 0,
      creators: hashtag.creators_count || 0,
      impact: hashtag.total_impact_score || 0, // Add impact
      trending: hashtag.trend_score > 100000,
      description: `${hashtag.videos_count || 0} videos by ${hashtag.creators_count || 0} creators`,
    })) || [];

    return NextResponse.json({ data: hashtags });
  } catch (error) {
    console.error('Error in hashtags API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5e. Update Communities API

File: `src/app/api/communities/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'total_views'; // Keep views as default
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('communities')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sort
    const orderBy = sortBy === 'views' ? 'total_views'
                   : sortBy === 'impact' ? 'total_impact_score'
                   : sortBy === 'videos' ? 'total_videos' 
                   : sortBy === 'creators' ? 'total_creators'
                   : 'total_views'; // Default to views
    
    query = query.order(orderBy, { ascending: false });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch communities' },
      { status: 500 }
    );
  }
}
```

### 5f. Update Nested Resource APIs

Apply similar changes to:
- `src/app/api/hashtags/[tag]/videos/route.ts` - Add impact sort option
- `src/app/api/sounds/[soundId]/videos/route.ts` - Add impact sort option
- `src/app/api/communities/[id]/videos/route.ts` - Add impact sort option
- `src/app/api/communities/[id]/creators/route.ts` - Sort by total_impact_score

Example for hashtag videos (lines 74-92):

```typescript
// Apply sorting
switch (sortBy) {
  case 'impact':
    query = query.order('impact_score', { ascending: false });
    break;
  case 'recent':
    query = query.order('created_at', { ascending: false });
    break;
  case 'views':
    query = query.order('views_count', { ascending: false });
    break;
  case 'likes':
    query = query.order('likes_count', { ascending: false });
    break;
  case 'trending':
    // For trending, fall back to impact
    query = query.order('impact_score', { ascending: false });
    break;
  default:
    query = query.order('impact_score', { ascending: false });
}
```

---

## Phase 6: Frontend Changes

### 6a. Update Sort Options

File: `src/app/components/filters/SortDropdown.tsx`

```typescript
// Add Impact as an additional sort option (views remains default in code)
export const VIDEO_SORT_OPTIONS: SortOption[] = [
  { value: 'views', label: 'Most Views' }, // Keep views first
  { value: 'impact', label: 'Impact' },
  { value: 'likes', label: 'Most Likes' },
  { value: 'recent', label: 'Most Recent' },
];

export const CREATOR_SORT_OPTIONS: SortOption[] = [
  { value: 'views', label: 'Most Views' }, // Keep views first
  { value: 'impact', label: 'Impact' },
  { value: 'followers', label: 'Most Followers' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'newest', label: 'Newest' },
];

export const HASHTAG_SORT_OPTIONS: SortOption[] = [
  { value: 'views', label: 'Most Views' }, // Keep views first
  { value: 'impact', label: 'Impact' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

export const SOUND_SORT_OPTIONS: SortOption[] = [
  { value: 'views', label: 'Most Views' }, // Keep views first
  { value: 'impact', label: 'Impact' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'likes', label: 'Most Likes' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'trending', label: 'Trending' },
];

export const COMMUNITY_SORT_OPTIONS: SortOption[] = [
  { value: 'total_views', label: 'Most Views' }, // Keep views first
  { value: 'impact', label: 'Impact' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'creators', label: 'Most Creators' },
];
```

### 6b. Create Impact Badge Component

File: `src/app/components/ImpactBadge.tsx`

```typescript
import React from 'react';

interface ImpactBadgeProps {
  impact: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ImpactBadge({ impact, size = 'md', showLabel = true }: ImpactBadgeProps) {
  const formatImpact = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return Math.round(num).toString();
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}
      title="Impact Score: Comments are weighted most, other metrics are small tiebreakers"
    >
      {showLabel && <span className="opacity-90">Impact</span>}
      <span className="font-bold">{formatImpact(impact)}</span>
    </span>
  );
}
```

### 6c. Update VideoCard Component

File: `src/app/components/VideoCard.tsx`

**Important**: Keep ALL existing view count displays. Add impact badge ALONGSIDE views, not replacing them:

```typescript
import { ImpactBadge } from './ImpactBadge';

// In the VideoCard component, add impact badge next to views (keep views visible!)
// This shows BOTH metrics side by side
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <ImpactBadge impact={video.impact || 0} size="sm" />
    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
      {formatNumber(video.views)} views {/* ← Views still visible! */}
    </span>
  </div>
</div>
```

**Result**: Users see both "Impact 42.7K" and "1.2M views" displayed together.

### 6d. Update Edits Page with Sort

File: `src/app/edits/page.tsx`

```typescript
'use client';

import React, { useState, useMemo } from 'react';
import { useVideos } from '../hooks/useData';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/Skeleton';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { NoVideosEmptyState } from '../components/empty-states';
import { SortDropdown, VIDEO_SORT_OPTIONS } from '../components/filters/SortDropdown';

export default function EditsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('views'); // Keep views as default
  
  const { data: videos, loading, error } = useVideos('', 100);

  const filteredVideos = useMemo(() => {
    let filtered = [...videos];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((video) => {
        const title = (video.title || '').toLowerCase();
        const creator = (video.creator?.username || '').toLowerCase();
        const hashtags = (video.hashtags || []).join(' ').toLowerCase();
        return title.includes(query) || creator.includes(query) || hashtags.includes(query);
      });
    }

    // Time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      const daysAgo = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '1y': 365,
      }[timeRange] || 0;

      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((video) => {
        if (!video.createdAt) return true;
        return new Date(video.createdAt) >= cutoffDate;
      });
    }

    // Sort
    switch (sortBy) {
      case 'impact':
        filtered.sort((a, b) => (b.impact || 0) - (a.impact || 0));
        break;
      case 'views':
        filtered.sort((a, b) => b.views - a.views);
        break;
      case 'likes':
        filtered.sort((a, b) => b.likes - a.likes);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      default:
        filtered.sort((a, b) => (b.impact || 0) - (a.impact || 0));
    }

    return filtered;
  }, [videos, searchQuery, timeRange, sortBy]);

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading videos: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Edits"
        description="Discover amazing video edits from talented creators"
        action={{
          label: 'Upload Edit',
          onClick: () => {},
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ),
        }}
        searchPlaceholder="Search titles, creators, hashtags..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        {/* Sort Control */}
        <div className="mb-6 flex items-center justify-between">
          <p style={{ color: 'var(--color-text-muted)' }}>
            Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredVideos.length}</span> video{filteredVideos.length !== 1 ? 's' : ''}
          </p>
          <SortDropdown
            value={sortBy}
            onChange={setSortBy}
            options={VIDEO_SORT_OPTIONS}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <NoVideosEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
      </div>
    </div>
  );
}
```

### 6e. Update HashtagCard Component

File: `src/app/components/HashtagCard.tsx`

Add impact badge to hashtag cards (keeping views visible):

```typescript
import { ImpactBadge } from './ImpactBadge';

// In the render section, add impact display alongside views
<div className="flex items-center gap-3">
  <ImpactBadge impact={hashtag.impact || 0} size="sm" />
  <span className="text-sm">{formatNumber(hashtag.views)} views</span> {/* Views still shown */}
</div>
```

**Result**: Hashtag cards show both Impact score and view count.

### 6f. Update Type Definitions

File: `src/app/types/index.ts` (or wherever types are defined)

Add `impact` field to relevant types:

```typescript
export interface Video {
  id: string;
  postId: string;
  title: string;
  thumbnail: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  impact: number; // Add this
  createdAt: string;
  creator: Creator | null;
  hashtags?: string[];
}

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
  views: number;
  impact: number; // Add this
}

export interface Sound {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videos: number;
  views: number;
  likes: number;
  impact: number; // Add this
}

export interface Hashtag {
  id: string;
  name: string;
  views: number;
  videos: number;
  creators: number;
  impact: number; // Add this
  trending: boolean;
  description: string;
}
```

---

## Phase 7: Migration Safety and Tests

### 7a. Unit Tests for compute_impact

```sql
-- Test edge cases for compute_impact function

-- Test 1: All zeros
SELECT compute_impact(0, 0, 0, 0, 0) = 0 AS test_all_zeros;

-- Test 2: Only comments (should be 100× comments)
SELECT compute_impact(0, 0, 10, 0, 0) = 1000.00 AS test_only_comments;

-- Test 3: Nulls treated as zeros
SELECT compute_impact(NULL, NULL, NULL, NULL, NULL) = 0 AS test_all_nulls;

-- Test 4: Large numbers (no overflow)
SELECT compute_impact(10000000, 5000000, 100000, 50000, 10000) 
  = (100 * 100000 + 0.1 * 50000 + 0.001 * 5000000 + 10000000 / 100000.0 + 0.1 * 10000) AS test_large_numbers;

-- Test 5: Precision (2 decimals)
SELECT compute_impact(123, 456, 7, 8, 9) = ROUND(100 * 7 + 0.1 * 8 + 0.001 * 456 + 123 / 100000.0 + 0.1 * 9, 2) AS test_precision;

-- Test 6: Missing saves (NULL saves)
SELECT compute_impact(1000, 100, 10, 5, NULL) = ROUND(100 * 10 + 0.1 * 5 + 0.001 * 100 + 1000 / 100000.0, 2) AS test_null_saves;
```

### 7b. Index Verification

```sql
-- Verify indexes are used for ORDER BY impact_score DESC
EXPLAIN ANALYZE
SELECT * FROM videos_hot
ORDER BY impact_score DESC
LIMIT 100;

-- Should show "Index Scan using idx_videos_impact_score_desc"

-- Test composite index for creator queries
EXPLAIN ANALYZE
SELECT * FROM videos_hot
WHERE creator_id = 'some_creator_id'
ORDER BY impact_score DESC
LIMIT 20;

-- Should show "Index Scan using idx_videos_creator_impact"
```

### 7c. Integration Tests

Create test file: `src/app/api/videos/__tests__/route.test.ts`

```typescript
import { GET } from '../route';

describe('Videos API - Impact Sort', () => {
  it('should return videos sorted by impact score', async () => {
    const request = new Request('http://localhost/api/videos?sort=impact');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.length).toBeGreaterThan(0);
    
    // Verify descending order
    for (let i = 0; i < data.data.length - 1; i++) {
      expect(data.data[i].impact).toBeGreaterThanOrEqual(data.data[i + 1].impact);
    }
  });

  it('should filter by minimum impact', async () => {
    const request = new Request('http://localhost/api/videos?impact_min=1000');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    data.data.forEach((video: any) => {
      expect(video.impact).toBeGreaterThanOrEqual(1000);
    });
  });
});
```

### 7d. Comparison Test

```sql
-- Compare top 100 by views vs top 100 by impact
-- This confirms Impact reranks based on comments
CREATE TEMP TABLE top_by_views AS
SELECT video_id, views_count, impact_score, comments_count, 'views' as ranking_method
FROM videos_hot
ORDER BY views_count DESC
LIMIT 100;

CREATE TEMP TABLE top_by_impact AS
SELECT video_id, views_count, impact_score, comments_count, 'impact' as ranking_method
FROM videos_hot
ORDER BY impact_score DESC
LIMIT 100;

-- Show videos in top 100 impact but NOT in top 100 views (comment-driven videos)
SELECT 
  i.video_id,
  i.views_count,
  i.comments_count,
  i.impact_score,
  'High impact, lower views' as note
FROM top_by_impact i
LEFT JOIN top_by_views v ON v.video_id = i.video_id
WHERE v.video_id IS NULL
ORDER BY i.impact_score DESC
LIMIT 20;

-- Show videos in top 100 views but NOT in top 100 impact (low engagement relative to views)
SELECT 
  v.video_id,
  v.views_count,
  v.comments_count,
  v.impact_score,
  'High views, lower impact' as note
FROM top_by_views v
LEFT JOIN top_by_impact i ON i.video_id = v.video_id
WHERE i.video_id IS NULL
ORDER BY v.views_count DESC
LIMIT 20;
```

---

## Phase 8: Rollout Plan

### Step 1: Database Migration (Staging First)

```bash
# Connect to Supabase staging
psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"

# Run migration
\i sql/019_impact_score.sql

# Run backfill (monitor progress)
UPDATE videos_hot SET impact_score = compute_impact(views_count, likes_count, comments_count, shares_count, collect_count), impact_updated_at = NOW();

# Run aggregate backfill
SELECT update_aggregations();

# Verify
SELECT COUNT(*), AVG(impact_score), MAX(impact_score) FROM videos_hot;
```

### Step 2: Monitor Locks and Performance

```sql
-- Check for long-running updates
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND query LIKE '%UPDATE%videos_hot%';

-- Check table size and estimate time
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE tablename IN ('videos_hot', 'creators_hot', 'sounds_hot', 'hashtags_hot');
```

### Step 3: Deploy API Changes

```bash
# Deploy backend changes
git checkout -b feature/impact-score
git add src/app/api/
git commit -m "Add impact score sorting to all APIs"
git push origin feature/impact-score

# Deploy to staging
# Test all endpoints with ?sort=impact
```

### Step 4: Deploy Frontend Changes

```bash
# Add frontend changes
git add src/app/components/ src/app/edits/ src/app/hashtags/
git commit -m "Add impact score UI and sorting"
git push

# Deploy to staging
# Manual QA of all pages
```

### Step 5: Production Migration

```bash
# Run on production database during low-traffic hours
# Use batched approach if table is large (>1M rows)

# Deploy code to production
# No feature flag needed since impact columns exist with default values
```

### Step 6: Verify and Monitor

```bash
# Check impact scores are populating
SELECT COUNT(*), AVG(impact_score) FROM videos_hot WHERE impact_score > 0;

# Monitor API latency for impact sorts
# Check frontend analytics for impact sort usage
```

---

## QA Checklist

### Database
- [ ] compute_impact function returns correct values for test cases
- [ ] impact_score column exists on videos_hot with default 0
- [ ] impact_updated_at timestamp is set
- [ ] Trigger fires on metric updates
- [ ] Indexes exist: idx_videos_impact_score_desc, idx_videos_creator_impact
- [ ] total_impact_score columns exist on creators_hot, sounds_hot, hashtags_hot, communities
- [ ] Aggregation function includes impact sums
- [ ] Backfill completed for all tables

### API Endpoints
- [ ] GET /api/videos?sort=impact returns videos sorted by impact
- [ ] GET /api/videos?impact_min=1000 filters correctly
- [ ] GET /api/creators?sort=impact returns creators sorted by total_impact_score
- [ ] GET /api/sounds?sort=impact returns sounds sorted by total_impact_score
- [ ] GET /api/hashtags?sort=impact returns hashtags sorted by total_impact_score
- [ ] GET /api/communities?sort=impact returns communities sorted by total_impact_score
- [ ] All nested resources (hashtag videos, sound videos, community videos/creators) support impact sort
- [ ] Response includes impact field in JSON

### Frontend
- [ ] SortDropdown shows "Impact" as first option
- [ ] Edits page sorts by impact by default
- [ ] ImpactBadge component displays correctly
- [ ] VideoCard shows impact score
- [ ] HashtagCard shows impact score
- [ ] Creator pages show total impact
- [ ] Sound pages show total impact
- [ ] Community pages show total impact
- [ ] Tooltip explains impact formula
- [ ] Impact filter chips work

### Performance
- [ ] EXPLAIN shows index usage for ORDER BY impact_score DESC
- [ ] Video list page loads in <500ms
- [ ] Creator list page loads in <500ms
- [ ] No N+1 queries
- [ ] Aggregation function completes in <10s

### Validation
- [ ] Top 100 by impact differs from top 100 by views
- [ ] Videos with high comments but lower views rank higher
- [ ] Impact score updates when metrics change
- [ ] Reconciliation function runs without errors
- [ ] Zero/null values handled correctly

---

## Summary of Files to Create/Modify

### SQL Files (Create)
- `sql/019_impact_score.sql` - Complete migration with functions, triggers, indexes

### API Endpoints (Modify)
- `src/app/api/videos/route.ts`
- `src/app/api/creators/route.ts`
- `src/app/api/sounds/route.ts`
- `src/app/api/hashtags/route.ts`
- `src/app/api/communities/route.ts`
- `src/app/api/hashtags/[tag]/videos/route.ts`
- `src/app/api/sounds/[soundId]/videos/route.ts`
- `src/app/api/communities/[id]/videos/route.ts`
- `src/app/api/communities/[id]/creators/route.ts`

### Frontend Components (Modify)
- `src/app/components/filters/SortDropdown.tsx` - Add impact to sort options
- `src/app/components/VideoCard.tsx` - Display impact badge
- `src/app/components/HashtagCard.tsx` - Display impact badge
- `src/app/edits/page.tsx` - Add sort control, default to impact
- `src/app/hashtags/page.tsx` - Add sort control
- `src/app/types/index.ts` - Add impact field to types

### Frontend Components (Create)
- `src/app/components/ImpactBadge.tsx` - New component for impact display

### Edge Functions (Create - Optional)
- `supabase/functions/reconcile-impact/index.ts` - Scheduled reconciliation job

---

## Formula Reference

```
Impact = 100 × comments + 0.1 × shares + 0.001 × likes + views ÷ 100000 + 0.1 × saves
```

**Weights**:
- Comments: 100× (primary signal)
- Shares: 0.1× 
- Likes: 0.001×
- Views: 0.00001× (views ÷ 100k)
- Saves: 0.1×

**Example**: 
- 50 comments, 10 shares, 1000 likes, 100k views, 20 saves
- Impact = 100×50 + 0.1×10 + 0.001×1000 + 100000/100000 + 0.1×20 = 5000 + 1 + 1 + 1 + 2 = **5005.00**

---

## End of Plan

This plan provides the complete implementation path for adding Impact Score to your application while keeping all existing view-based features intact.

