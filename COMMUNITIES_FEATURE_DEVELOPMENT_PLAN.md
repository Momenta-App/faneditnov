# Communities Feature Development Plan

## Goal

Add a Communities section that behaves like multi-hashtag collections, with ranked videos, creators, and hashtags, plus fast, accurate totals that update in real time.

A Community is a curated collection of content that matches a specific set of hashtags. Users can create communities, add/edit hashtags, and view ranked content with real-time updates as new videos are ingested.

---

## Implementation Status

### ✅ Completed
- Database schema created
- Frontend API routes created
- Hashtag editing working
- Videos are removed properly when hashtags are removed
- Frontend filters out 0-video memberships

### 🔴 Current Problem: Inaccurate Counts After Hashtag Removal

**Issue:** After removing a hashtag from a community, the membership tables have incorrect counts.

**Example:**
- Community only has 2 videos in `community_video_memberships` ✓
- But `community_hashtag_memberships` shows 35 videos and 185M views ✗
- Should show counts matching the 2 actual videos (~10M views)

**Root Cause:**
When we remove videos, we decrement hashtag counts for ALL hashtags on the removed video, but we're not properly recalculating the counts based on the CURRENT videos in the community. We need to recalculate from scratch.

**What Needs to Happen:**
1. When a hashtag is removed, recalculate hashtag memberships based on ACTUAL videos in `community_video_memberships`
2. Recalculate creator memberships based on ACTUAL videos in `community_video_memberships`
3. Only delete rows for hashtags NOT in `communities.linked_hashtags`
4. Delete creator memberships with 0 videos

**Fix Plan:**

Instead of trying to increment/decrement counts, we should **RECALCULATE from scratch** based on the actual videos in `community_video_memberships`.

**Step 1: Add recalculation functions**
Create two functions that recalculate hashtag and creator memberships from scratch by actually counting the videos in `community_video_memberships`.

**Step 2: Update `sync_community_hashtags`** ✅ DONE
After removing videos, call the recalculation functions instead of trying to maintain counts.

**What Was Changed:**
1. Added `recalculate_community_hashtag_memberships()` function - recalculates hashtag counts from scratch
2. Added `recalculate_community_creator_memberships()` function - recalculates creator counts from scratch
3. Updated `sync_community_hashtags()` to call these recalculation functions instead of increment/decrement
4. Removed all the complex increment/decrement logic

**How It Works Now:**
- When videos are removed, we simply delete them from `community_video_memberships`
- Then we call the recalculation functions which count actual videos
- This ensures counts are always accurate based on what's actually in the community

**Next Step:** Deploy the updated SQL and test.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Database Schema**
   - `videos_hot` table with `views_count`, `likes_count`, `created_at`
   - `creators_hot` table with creator data
   - `hashtags_hot` table with hashtag metadata
   - `video_hashtag_facts` table tracking video-hashtag relationships
   - `video_play_count_history` for tracking view deltas
   - `rejected_videos` table for quality control

2. **Ingestion Pipeline**
   - `ingest_brightdata_snapshot_v2()` processes TikTok data
   - Updates aggregates with delta-based calculations
   - Handles hashtag extraction and normalization

3. **Frontend Infrastructure**
   - Hashtag detail page pattern exists (`/hashtag/[tag]`)
   - Sound detail page pattern exists (`/sound/[soundId]`)
   - Filter components exist (`FilterBar`, `SearchInput`, `SortDropdown`, `TimeRangeFilter`)
   - Video and creator card components exist
   - API route patterns established

### What's Missing ⚠️

1. Community table and schema
2. Community membership tracking tables
3. Community aggregates (totals, per-creator, per-hashtag)
4. Backfill mechanism for existing videos
5. Community CRUD APIs
6. Community detail page UI
7. Communities index page

---

## Development Tasks

### Phase 1: Database Schema & Functions (2-3 hours)

#### Task 1.1: Create Communities Table
**File:** `sql/017_communities.sql` (new file)

Create the main communities table with all required fields:

```sql
-- ============================================================================
-- COMMUNITIES TABLE
-- Main table for community entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  profile_image_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  linked_hashtags TEXT[] NOT NULL DEFAULT '{}',  -- Array of hashtag names (normalized, lowercase)
  links JSONB DEFAULT '{}',  -- { website, x, instagram, tiktok, youtube, other }
  total_views BIGINT DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  total_creators INTEGER DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES auth.users(id)
);

-- Indexes for communities
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_linked_hashtags ON communities USING GIN(linked_hashtags);
CREATE INDEX IF NOT EXISTS idx_communities_total_views ON communities(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_communities_total_videos ON communities(total_videos DESC);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_communities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_communities_updated_at();

-- RLS Policies
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON communities FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON communities 
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE communities IS 'Communities are multi-hashtag collections with real-time aggregates';
COMMENT ON COLUMN communities.linked_hashtags IS 'Array of normalized hashtag names that match this community';
COMMENT ON COLUMN communities.links IS 'Social media and website links in JSONB format';
```

#### Task 1.2: Create Community Memberships Tables
**File:** `sql/017_communities.sql` (continued)

Create tables to track which videos, creators, and hashtags belong to each community:

```sql
-- ============================================================================
-- COMMUNITY_VIDEO_MEMBERSHIPS
-- Tracks which videos belong to which communities
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_video_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos_hot(video_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_video UNIQUE(community_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_community_video_community ON community_video_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_video_video ON community_video_memberships(video_id);
CREATE INDEX IF NOT EXISTS idx_community_video_joined_at ON community_video_memberships(joined_at DESC);

-- ============================================================================
-- COMMUNITY_CREATOR_MEMBERSHIPS
-- Tracks which creators belong to which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_creator_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,  -- Sum of play_count for this creator's videos in this community
  video_count INTEGER DEFAULT 0,  -- Count of creator's videos in this community
  first_video_at TIMESTAMP WITH TIME ZONE,
  last_video_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_creator UNIQUE(community_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_community_creator_community ON community_creator_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_creator ON community_creator_memberships(creator_id);
CREATE INDEX IF NOT EXISTS idx_community_creator_total_views ON community_creator_memberships(total_views DESC);

-- ============================================================================
-- COMMUNITY_HASHTAG_MEMBERSHIPS
-- Tracks which hashtags appear in which communities with aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_hashtag_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL REFERENCES hashtags_hot(hashtag) ON DELETE CASCADE,
  total_views BIGINT DEFAULT 0,  -- Sum of play_count for this hashtag within this community
  video_count INTEGER DEFAULT 0,  -- Count of videos with this hashtag in this community
  first_used_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_community_hashtag UNIQUE(community_id, hashtag)
);

CREATE INDEX IF NOT EXISTS idx_community_hashtag_community ON community_hashtag_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_hashtag ON community_hashtag_memberships(hashtag);
CREATE INDEX IF NOT EXISTS idx_community_hashtag_total_views ON community_hashtag_memberships(total_views DESC);

-- Enable RLS
ALTER TABLE community_video_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_creator_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_hashtag_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON community_video_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_creator_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON community_hashtag_memberships FOR SELECT USING (true);

CREATE POLICY "Authenticated write access" ON community_video_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_creator_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON community_hashtag_memberships 
  FOR ALL USING (auth.role() = 'authenticated');
```

#### Task 1.3: Create Community Helper Functions
**File:** `sql/017_communities.sql` (continued)

Create functions to check if a video matches a community's hashtag set, and to update aggregates:

```sql
-- ============================================================================
-- FUNCTION: check_video_community_match
-- Returns TRUE if a video's hashtags intersect with a community's linked_hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION check_video_community_match(
  p_video_id TEXT,
  p_community_hashtags TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM video_hashtag_facts vhf
    WHERE vhf.video_id = p_video_id
      AND vhf.hashtag = ANY(p_community_hashtags)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: get_video_hashtags
-- Returns array of hashtags for a given video
-- ============================================================================

CREATE OR REPLACE FUNCTION get_video_hashtags(p_video_id TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT hashtag 
    FROM video_hashtag_facts 
    WHERE video_id = p_video_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_community_video_membership
-- Adds or removes a video from a community based on hashtag match
-- ============================================================================

CREATE OR REPLACE FUNCTION update_community_video_membership(
  p_community_id UUID,
  p_video_id TEXT
) RETURNS void AS $$
DECLARE
  v_matches BOOLEAN;
  v_play_count INTEGER;
  v_creator_id TEXT;
  v_video_hashtags TEXT[];
  v_hashtag TEXT;
BEGIN
  -- Get video hashtags
  v_video_hashtags := get_video_hashtags(p_video_id);
  
  -- Check if video matches community
  v_matches := EXISTS (
    SELECT 1
    FROM communities c
    WHERE c.id = p_community_id
      AND c.linked_hashtags && v_video_hashtags  -- Array overlap operator
  );
  
  -- Get video details
  SELECT views_count, creator_id INTO v_play_count, v_creator_id
  FROM videos_hot
  WHERE video_id = p_video_id;
  
  IF v_matches THEN
    -- Add/update membership
    INSERT INTO community_video_memberships (community_id, video_id)
    VALUES (p_community_id, p_video_id)
    ON CONFLICT (community_id, video_id) DO UPDATE SET
      last_updated = NOW();
    
    -- Update creator membership
    INSERT INTO community_creator_memberships (community_id, creator_id, total_views, video_count)
    VALUES (p_community_id, v_creator_id, v_play_count, 1)
    ON CONFLICT (community_id, creator_id) DO UPDATE SET
      total_views = community_creator_memberships.total_views + EXCLUDED.total_views,
      video_count = community_creator_memberships.video_count + 1,
      last_video_at = NOW(),
      last_updated = NOW();
    
    -- Update hashtag memberships for each matching hashtag
    FOR v_hashtag IN 
      SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      WHERE hashtag = ANY((SELECT linked_hashtags FROM communities WHERE id = p_community_id))
    LOOP
      INSERT INTO community_hashtag_memberships (community_id, hashtag, total_views, video_count)
      VALUES (p_community_id, v_hashtag, v_play_count, 1)
      ON CONFLICT (community_id, hashtag) DO UPDATE SET
        total_views = community_hashtag_memberships.total_views + EXCLUDED.total_views,
        video_count = community_hashtag_memberships.video_count + 1,
        last_used_at = NOW(),
        last_updated = NOW();
    END LOOP;
  ELSE
    -- First check if video should remain (might have other matching hashtags)
    SELECT EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = p_community_id
        AND c.linked_hashtags && v_video_hashtags
    ) INTO v_matches;
    
    -- Only remove if no hashtags match
    IF NOT v_matches THEN
      DELETE FROM community_video_memberships
      WHERE community_id = p_community_id AND video_id = p_video_id;
      
      -- Update creator membership (decrement)
      UPDATE community_creator_memberships
      SET total_views = total_views - v_play_count,
          video_count = video_count - 1,
          last_updated = NOW()
      WHERE community_id = p_community_id AND creator_id = v_creator_id;
      
      -- Update hashtag memberships (decrement for all video hashtags)
      FOR v_hashtag IN SELECT hashtag FROM UNNEST(v_video_hashtags) AS hashtag
      LOOP
        UPDATE community_hashtag_memberships
        SET total_views = total_views - v_play_count,
            video_count = video_count - 1,
            last_updated = NOW()
        WHERE community_id = p_community_id AND hashtag = v_hashtag;
      END LOOP;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_community_totals
-- Recalculates and updates total aggregates for a community
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
      WHERE community_id = p_community_id
    ),
    total_likes = (
      SELECT COALESCE(SUM(v.likes_count), 0)
      FROM community_video_memberships cvm
      JOIN videos_hot v ON v.video_id = cvm.video_id
      WHERE cvm.community_id = p_community_id
    ),
    updated_at = NOW()
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: backfill_community
-- Backfills a community's memberships from existing videos
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_community(p_community_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hashtags TEXT[];
  v_video RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get community hashtags
  SELECT linked_hashtags INTO v_hashtags
  FROM communities
  WHERE id = p_community_id;
  
  IF v_hashtags IS NULL OR array_length(v_hashtags, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No hashtags linked to community');
  END IF;
  
  -- Process each existing video
  FOR v_video IN 
    SELECT DISTINCT v.video_id, v.creator_id, v.views_count
    FROM video_hashtag_facts vhf
    JOIN videos_hot v ON v.video_id = vhf.video_id
    WHERE vhf.hashtag = ANY(v_hashtags)
  LOOP
    PERFORM update_community_video_membership(p_community_id, v_video.video_id);
    v_count := v_count + 1;
  END LOOP;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object('success', true, 'videos_processed', v_count);
END;
$$ LANGUAGE plpgsql;
```

#### Task 1.4: Update Ingestion Function
**File:** `sql/011_ingestion_v2.sql`

Add community membership updates to the ingestion flow:

```sql
-- Add to ingest_brightdata_snapshot_v2 function after hashtag processing (around line 354)

      -- =======================================================================
      -- UPDATE COMMUNITY MEMBERSHIPS
      -- Check and update community memberships for this video
      -- =======================================================================
      FOR v_hashtag IN 
        SELECT value::TEXT 
        FROM jsonb_array_elements_text(COALESCE(v_element->'hashtags', '[]'::JSONB))
      LOOP
        -- Normalize hashtag
        v_hashtag := LOWER(REPLACE(v_hashtag, '#', ''));
        
        -- Update communities that include this hashtag
        PERFORM update_community_video_membership(c.id, v_post_id)
        FROM communities c
        WHERE v_hashtag = ANY(c.linked_hashtags);
      END LOOP;
      
      -- Update community totals for all affected communities
      PERFORM update_community_totals(c.id)
      FROM communities c
      WHERE EXISTS (
        SELECT 1 FROM video_hashtag_facts vhf
        WHERE vhf.video_id = v_post_id
          AND vhf.hashtag = ANY(c.linked_hashtags)
      );
```

---

### Phase 2: API Routes (3-4 hours)

#### Task 2.1: Communities List API
**File:** `src/app/api/communities/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'total_views';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('communities')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sort
    const orderBy = sortBy === 'videos' ? 'total_videos' 
                   : sortBy === 'creators' ? 'total_creators'
                   : 'total_views';
    
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, description, linked_hashtags, profile_image_url, cover_image_url, links } = body;

    // Validate required fields
    if (!name || !slug || !linked_hashtags || linked_hashtags.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Normalize hashtags (lowercase, remove #)
    const normalizedHashtags = linked_hashtags.map((tag: string) => 
      tag.toLowerCase().replace(/^#/, '')
    );

    // Insert community
    const { data, error } = await supabase
      .from('communities')
      .insert({
        name,
        slug,
        description,
        linked_hashtags: normalizedHashtags,
        profile_image_url,
        cover_image_url,
        links: links || {}
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger backfill
    const { error: backfillError } = await supabase.rpc('backfill_community', {
      p_community_id: data.id
    });

    if (backfillError) {
      console.error('Backfill error:', backfillError);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating community:', error);
    return NextResponse.json(
      { error: 'Failed to create community' },
      { status: 500 }
    );
  }
}
```

#### Task 2.2: Community Detail API
**File:** `src/app/api/communities/[id]/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching community:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Normalize hashtags if provided
    if (body.linked_hashtags) {
      body.linked_hashtags = body.linked_hashtags.map((tag: string) => 
        tag.toLowerCase().replace(/^#/, '')
      );
    }

    const { data, error } = await supabase
      .from('communities')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // If hashtags changed, recalculate memberships
    if (body.linked_hashtags) {
      const { error: backfillError } = await supabase.rpc('backfill_community', {
        p_community_id: params.id
      });

      if (backfillError) {
        console.error('Backfill error:', backfillError);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating community:', error);
    return NextResponse.json(
      { error: 'Failed to update community' },
      { status: 500 }
    );
  }
}
```

#### Task 2.3: Community Videos API
**File:** `src/app/api/communities/[id]/videos/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const timeRange = searchParams.get('timeRange') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build time filter
    let timeFilter = {};
    if (timeRange !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      
      switch (timeRange) {
        case '24h': cutoff.setHours(now.getHours() - 24); break;
        case '7d': cutoff.setDate(now.getDate() - 7); break;
        case '30d': cutoff.setDate(now.getDate() - 30); break;
        case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
      }
      timeFilter = { created_at: { gte: cutoff.toISOString() } };
    }

    // Query videos in this community
    let query = supabase
      .from('community_video_memberships')
      .select(`
        video:video_id (
          video_id,
          post_id,
          creator_id,
          caption,
          description,
          views_count,
          likes_count,
          comments_count,
          shares_count,
          duration_seconds,
          created_at,
          cover_url,
          video_url
        )
      `, { count: 'exact' })
      .eq('community_id', params.id);

    if (search) {
      // Search in video caption/description
      query = query.or(`video.caption.ilike.%${search}%,video.description.ilike.%${search}%`);
    }

    // Sort
    const orderBy = sortBy === 'recent' ? 'video.created_at' 
                   : sortBy === 'likes' ? 'video.likes_count'
                   : 'video.views_count';
    
    query = query.order(orderBy, { ascending: false });

    // Time filter
    if (timeRange !== 'all') {
      query = query.gte('video.created_at', timeFilter.created_at.gte);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch creator data for each video
    const videoIds = data?.map(item => item.video?.creator_id) || [];
    const { data: creators } = await supabase
      .from('creators_hot')
      .select('creator_id, username, display_name, avatar_url, verified')
      .in('creator_id', videoIds);

    const creatorsMap = new Map(creators?.map(c => [c.creator_id, c]) || []);

    // Fetch hashtags for videos
    const videoVideoIds = data?.map(item => item.video?.video_id) || [];
    const { data: hashtags } = await supabase
      .from('video_hashtag_facts')
      .select('video_id, hashtag')
      .in('video_id', videoVideoIds);

    const hashtagsMap = new Map<string, string[]>();
    hashtags?.forEach(h => {
      if (!hashtagsMap.has(h.video_id)) {
        hashtagsMap.set(h.video_id, []);
      }
      hashtagsMap.get(h.video_id)?.push(h.hashtag);
    });

    // Format response
    const formattedData = data?.map(item => ({
      id: item.video?.video_id,
      postId: item.video?.post_id,
      title: item.video?.caption?.substring(0, 100),
      description: item.video?.description,
      thumbnail: item.video?.cover_url,
      videoUrl: item.video?.video_url,
      creator: creatorsMap.get(item.video?.creator_id),
      views: item.video?.views_count,
      likes: item.video?.likes_count,
      comments: item.video?.comments_count,
      shares: item.video?.shares_count,
      duration: item.video?.duration_seconds,
      createdAt: item.video?.created_at,
      hashtags: hashtagsMap.get(item.video?.video_id) || []
    })) || [];

    return NextResponse.json({
      data: formattedData,
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching community videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community videos' },
      { status: 500 }
    );
  }
}
```

#### Task 2.4: Community Creators API
**File:** `src/app/api/communities/[id]/creators/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('community_creator_memberships')
      .select(`
        creator:creator_id (
          creator_id,
          username,
          display_name,
          avatar_url,
          verified,
          bio
        ),
        total_views,
        video_count
      `)
      .eq('community_id', params.id)
      .order('total_views', { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = data?.map(item => ({
      creator_id: item.creator?.creator_id,
      username: item.creator?.username,
      display_name: item.creator?.display_name,
      avatar_url: item.creator?.avatar_url,
      verified: item.creator?.verified,
      bio: item.creator?.bio,
      total_views: item.total_views,
      video_count: item.video_count
    })) || [];

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Error fetching community creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community creators' },
      { status: 500 }
    );
  }
}
```

#### Task 2.5: Community Hashtags API
**File:** `src/app/api/communities/[id]/hashtags/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('community_hashtag_memberships')
      .select(`
        hashtag:hashtag (
          hashtag,
          hashtag_norm,
          views_total,
          videos_count
        ),
        total_views,
        video_count
      `)
      .eq('community_id', params.id)
      .order('total_views', { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = data?.map(item => ({
      hashtag: item.hashtag?.hashtag,
      hashtag_norm: item.hashtag?.hashtag_norm,
      total_views: item.total_views,
      video_count: item.video_count,
      global_views: item.hashtag?.views_total,
      global_videos: item.hashtag?.videos_count
    })) || [];

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Error fetching community hashtags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community hashtags' },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: Frontend Types & Hooks (1 hour)

#### Task 3.1: Add Community Types
**File:** `src/app/types/data.ts`

Add community-related types:

```typescript
export interface Community {
  id: string;
  name: string;
  slug: string;
  profile_image_url?: string;
  cover_image_url?: string;
  description?: string;
  linked_hashtags: string[];
  links: {
    website?: string;
    x?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    other?: string;
  };
  total_views: number;
  total_videos: number;
  total_creators: number;
  total_likes: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  verified: boolean;
  bio?: string;
  total_views: number;  // Total views within this community
  video_count: number;  // Number of videos in this community
}

export interface CommunityHashtag {
  hashtag: string;
  hashtag_norm: string;
  total_views: number;  // Total views within this community
  video_count: number;  // Number of videos in this community
  global_views: number; // Total views globally
  global_videos: number; // Total videos globally
}
```

#### Task 3.2: Add Community Hooks
**File:** `src/app/hooks/useData.ts`

Add hooks for fetching community data:

```typescript
export function useCommunities(search = '', sortBy = 'total_views', limit = 50) {
  const [data, setData] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommunities() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          search,
          sort: sortBy,
          limit: limit.toString()
        });
        const response = await fetch(`/api/communities?${params}`);
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch communities');
      } finally {
        setLoading(false);
      }
    }
    fetchCommunities();
  }, [search, sortBy, limit]);

  return { data, loading, error };
}

export function useCommunity(communityId: string) {
  const [data, setData] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommunity() {
      try {
        setLoading(true);
        const response = await fetch(`/api/communities/${communityId}`);
        if (response.status === 404) {
          setError('Community not found');
          return;
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch community');
      } finally {
        setLoading(false);
      }
    }
    if (communityId) fetchCommunity();
  }, [communityId]);

  return { data, loading, error };
}

export function useCommunityVideos(
  communityId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100
) {
  const [data, setData] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          search,
          sort: sortBy,
          timeRange,
          limit: limit.toString()
        });
        const response = await fetch(`/api/communities/${communityId}/videos?${params}`);
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch videos');
      } finally {
        setLoading(false);
      }
    }
    if (communityId) fetchVideos();
  }, [communityId, search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useCommunityCreators(communityId: string) {
  const [data, setData] = useState<CommunityCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCreators() {
      try {
        setLoading(true);
        const response = await fetch(`/api/communities/${communityId}/creators`);
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch creators');
      } finally {
        setLoading(false);
      }
    }
    if (communityId) fetchCreators();
  }, [communityId]);

  return { data, loading, error };
}

export function useCommunityHashtags(communityId: string) {
  const [data, setData] = useState<CommunityHashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHashtags() {
      try {
        setLoading(true);
        const response = await fetch(`/api/communities/${communityId}/hashtags`);
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch hashtags');
      } finally {
        setLoading(false);
      }
    }
    if (communityId) fetchHashtags();
  }, [communityId]);

  return { data, loading, error };
}
```

---

### Phase 4: Frontend Pages (4-5 hours)

#### Task 4.1: Community Card Component
**File:** `src/app/components/CommunityCard.tsx` (new file)

```typescript
import Link from 'next/link';
import { Community } from '../types/data';
import Image from 'next/image';

interface CommunityCardProps {
  community: Community;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Link href={`/community/${community.slug}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden">
        {community.cover_image_url && (
          <div className="relative w-full h-32">
            <Image
              src={community.cover_image_url}
              alt={community.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {community.profile_image_url && (
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={community.profile_image_url}
                  alt={community.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{community.name}</h3>
              {community.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {community.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 mt-4 text-sm">
            <div>
              <span className="text-gray-500">Views</span>
              <p className="font-semibold">{formatNumber(community.total_views)}</p>
            </div>
            <div>
              <span className="text-gray-500">Videos</span>
              <p className="font-semibold">{formatNumber(community.total_videos)}</p>
            </div>
            <div>
              <span className="text-gray-500">Creators</span>
              <p className="font-semibold">{formatNumber(community.total_creators)}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

#### Task 4.2: Communities Index Page
**File:** `src/app/communities/page.tsx` (new file)

```typescript
'use client';

import { useState } from 'react';
import { useCommunities } from '../hooks/useData';
import { CommunityCard } from '../components/CommunityCard';
import { SearchInput, SortDropdown } from '../components/filters';
import { Skeleton } from '../components/Skeleton';

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_views');
  const { data: communities, loading } = useCommunities(search, sortBy);

  const sortOptions = [
    { value: 'total_views', label: 'Most Views' },
    { value: 'total_videos', label: 'Most Videos' },
    { value: 'total_creators', label: 'Most Creators' },
    { value: 'created_at', label: 'Newest' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Communities</h1>
          <p className="text-gray-600">
            Discover curated collections of content organized by hashtag groups
          </p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-64">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities..."
            />
          </div>
          <SortDropdown
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={sortOptions}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No communities found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Task 4.3: Community Detail Page
**File:** `src/app/community/[slug]/page.tsx` (new file)

```typescript
'use client';

import { useState } from 'react';
import { useCommunity, useCommunityVideos, useCommunityCreators, useCommunityHashtags } from '../../hooks/useData';
import { VideoCard } from '../../components/VideoCard';
import { CreatorCard } from '../../components/CreatorCard';
import { FilterBar, SearchInput, SortDropdown, TimeRangeFilter } from '../../components/filters';
import { Skeleton } from '../../components/Skeleton';
import { NoVideosEmptyState } from '../../components/empty-states';
import Image from 'next/image';
import Link from 'next/link';

export default function CommunityPage({ params }: { params: { slug: string } }) {
  const [activeTab, setActiveTab] = useState<'videos' | 'creators' | 'hashtags'>('videos');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('views');
  const [timeRange, setTimeRange] = useState('all');

  // Find community by slug first
  const { data: communitiesData } = useCommunities('', 'created_at', 1000);
  const community = communitiesData?.find(c => c.slug === params.slug);
  const communityId = community?.id || '';

  const { data: communityData } = useCommunity(communityId);
  const { data: videos } = useCommunityVideos(communityId, search, sortBy, timeRange);
  const { data: creators } = useCommunityCreators(communityId);
  const { data: hashtags } = useCommunityHashtags(communityId);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (!communityData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Skeleton className="w-full max-w-7xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        {communityData.cover_image_url && (
          <div className="relative w-full h-64">
            <Image
              src={communityData.cover_image_url}
              alt={communityData.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start gap-6">
            {communityData.profile_image_url && (
              <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={communityData.profile_image_url}
                  alt={communityData.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{communityData.name}</h1>
              {communityData.description && (
                <p className="text-gray-600 mb-4">{communityData.description}</p>
              )}
              
              {/* Stats */}
              <div className="flex gap-6">
                <div>
                  <span className="text-gray-500">Views</span>
                  <p className="text-xl font-semibold">{formatNumber(communityData.total_views)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Videos</span>
                  <p className="text-xl font-semibold">{formatNumber(communityData.total_videos)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Creators</span>
                  <p className="text-xl font-semibold">{formatNumber(communityData.total_creators)}</p>
                </div>
              </div>

              {/* Links */}
              {communityData.links && (
                <div className="flex gap-4 mt-4">
                  {communityData.links.website && (
                    <a href={communityData.links.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      Website
                    </a>
                  )}
                  {communityData.links.tiktok && (
                    <a href={communityData.links.tiktok} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      TikTok
                    </a>
                  )}
                  {communityData.links.instagram && (
                    <a href={communityData.links.instagram} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      Instagram
                    </a>
                  )}
                  {communityData.links.youtube && (
                    <a href={communityData.links.youtube} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      YouTube
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 border-b mb-6">
          <button
            onClick={() => setActiveTab('videos')}
            className={`pb-2 px-4 font-medium ${
              activeTab === 'videos'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Top Videos
          </button>
          <button
            onClick={() => setActiveTab('creators')}
            className={`pb-2 px-4 font-medium ${
              activeTab === 'creators'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Top Creators
          </button>
          <button
            onClick={() => setActiveTab('hashtags')}
            className={`pb-2 px-4 font-medium ${
              activeTab === 'hashtags'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Top Hashtags
          </button>
        </div>

        {/* Filters (only for videos tab) */}
        {activeTab === 'videos' && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        )}

        {/* Content */}
        {activeTab === 'videos' && (
          videos?.length === 0 ? (
            <NoVideosEmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos?.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )
        )}

        {activeTab === 'creators' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators?.map((creator) => (
              <Link key={creator.creator_id} href={`/creator/${creator.creator_id}`}>
                <CreatorCard creator={creator} />
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'hashtags' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hashtags?.map((hashtag) => (
              <Link key={hashtag.hashtag} href={`/hashtag/${hashtag.hashtag_norm}`}>
                <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold mb-2">#{hashtag.hashtag}</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Community Views</span>
                      <p className="font-semibold">{formatNumber(hashtag.total_views)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Community Videos</span>
                      <p className="font-semibold">{formatNumber(hashtag.video_count)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Global Views</span>
                      <p className="text-gray-600">{formatNumber(hashtag.global_views)}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Task 4.4: Update Navigation
**File:** `src/app/components/Header.tsx`

Add Communities link to navigation:

```typescript
// Add to navigation items
<Link href="/communities">Communities</Link>
```

---

### Phase 4.5: Community Editing Feature (4-5 hours)

#### Task 4.5.1: Enhanced Database Functions for Smart Video Removal
**File:** `sql/017_communities.sql` (modify existing file)

Add a new function to intelligently handle hashtag removals without double-removing videos:

```sql
-- ============================================================================
-- FUNCTION: sync_community_hashtags
-- Syncs community video memberships after hashtag changes
-- Intelligently adds new videos and removes only videos with NO matching hashtags
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_community_hashtags(
  p_community_id UUID,
  p_old_hashtags TEXT[],
  p_new_hashtags TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_new_hashtags TEXT[];  -- Hashtags that were added
  v_removed_hashtags TEXT[];  -- Hashtags that were removed
  v_video RECORD;
  v_video_hashtags TEXT[];
  v_matches BOOLEAN;
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
BEGIN
  -- Get newly added hashtags
  v_new_hashtags := p_new_hashtags - p_old_hashtags;
  
  -- Get removed hashtags
  v_removed_hashtags := p_old_hashtags - p_new_hashtags;
  
  -- Add videos with new hashtags
  IF array_length(v_new_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT v.video_id, v.creator_id, v.views_count
      FROM video_hashtag_facts vhf
      JOIN videos_hot v ON v.video_id = vhf.video_id
      WHERE vhf.hashtag = ANY(v_new_hashtags)
        AND NOT EXISTS (
          SELECT 1 FROM community_video_memberships cvm
          WHERE cvm.community_id = p_community_id 
            AND cvm.video_id = v.video_id
        )
    LOOP
      PERFORM update_community_video_membership(p_community_id, v_video.video_id);
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;
  
  -- Remove videos that have NO matching hashtags after removal
  IF array_length(v_removed_hashtags, 1) > 0 THEN
    FOR v_video IN 
      SELECT DISTINCT video_id 
      FROM community_video_memberships 
      WHERE community_id = p_community_id
    LOOP
      -- Get current video hashtags
      v_video_hashtags := get_video_hashtags(v_video.video_id);
      
      -- Check if video has ANY matching hashtags with new set
      v_matches := EXISTS (
        SELECT 1 
        WHERE p_new_hashtags && v_video_hashtags
      );
      
      -- Remove only if video has NO matching hashtags
      IF NOT v_matches THEN
        DELETE FROM community_video_memberships
        WHERE community_id = p_community_id 
          AND video_id = v_video.video_id;
        
        v_removed_count := v_removed_count + 1;
        
        -- Update creator membership (decrement)
        UPDATE community_creator_memberships
        SET total_views = GREATEST(0, total_views - (
          SELECT views_count FROM videos_hot WHERE video_id = v_video.video_id
        )),
        video_count = GREATEST(0, video_count - 1),
        last_updated = NOW()
        WHERE community_id = p_community_id 
          AND creator_id = (SELECT creator_id FROM videos_hot WHERE video_id = v_video.video_id);
      END IF;
    END LOOP;
  END IF;
  
  -- Update totals
  PERFORM update_community_totals(p_community_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'new_hashtags', v_new_hashtags,
    'removed_hashtags', v_removed_hashtags
  );
END;
$$ LANGUAGE plpgsql;
```

#### Task 4.5.2: Update Community Detail API to Call Sync Function
**File:** `src/app/api/communities/[id]/route.ts` (modify existing file)

Update the PATCH handler to use the new sync function:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Normalize hashtags if provided
    let normalizedHashtags = body.linked_hashtags;
    if (normalizedHashtags) {
      normalizedHashtags = normalizedHashtags.map((tag: string) => 
        tag.toLowerCase().replace(/^#/, '')
      );
    }

    // Get old hashtags before update
    const { data: oldData } = await supabaseAdmin
      .from('communities')
      .select('linked_hashtags')
      .eq('id', params.id)
      .single();

    const { data, error } = await supabaseAdmin
      .from('communities')
      .update({ ...body, linked_hashtags: normalizedHashtags })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // If hashtags changed, sync memberships intelligently
    if (normalizedHashtags && JSON.stringify(oldData?.linked_hashtags) !== JSON.stringify(normalizedHashtags)) {
      const { data: syncResult, error: syncError } = await supabaseAdmin.rpc('sync_community_hashtags', {
        p_community_id: params.id,
        p_old_hashtags: oldData?.linked_hashtags || [],
        p_new_hashtags: normalizedHashtags
      });

      if (syncError) {
        console.error('Sync error:', syncError);
        // Fallback to full backfill if sync fails
        await supabaseAdmin.rpc('backfill_community', {
          p_community_id: params.id
        });
      } else {
        console.log('Sync result:', syncResult);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating community:', error);
    return NextResponse.json(
      { error: 'Failed to update community' },
      { status: 500 }
    );
  }
}
```

#### Task 4.5.3: Create Community Edit Modal Component
**File:** `src/app/components/CommunityEditModal.tsx` (new file)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Community } from '../types/data';

interface CommunityEditModalProps {
  community: Community;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Community) => Promise<void>;
}

export function CommunityEditModal({ community, isOpen, onClose, onSave }: CommunityEditModalProps) {
  const [formData, setFormData] = useState({
    name: community.name,
    description: community.description || '',
    linked_hashtags: community.linked_hashtags || [],
    profile_image_url: community.profile_image_url || '',
    cover_image_url: community.cover_image_url || '',
    links: community.links || {}
  });
  
  const [newHashtag, setNewHashtag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: community.name,
        description: community.description || '',
        linked_hashtags: community.linked_hashtags || [],
        profile_image_url: community.profile_image_url || '',
        cover_image_url: community.cover_image_url || '',
        links: community.links || {}
      });
    }
  }, [community, isOpen]);

  const handleAddHashtag = () => {
    if (newHashtag.trim() && !formData.linked_hashtags.includes(newHashtag.toLowerCase())) {
      setFormData({
        ...formData,
        linked_hashtags: [...formData.linked_hashtags, newHashtag.toLowerCase().replace(/^#/, '')]
      });
      setNewHashtag('');
    }
  };

  const handleRemoveHashtag = (hashtag: string) => {
    setFormData({
      ...formData,
      linked_hashtags: formData.linked_hashtags.filter(h => h !== hashtag)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(formData as Community);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit Community</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>

            {/* Profile Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Image URL
              </label>
              <input
                type="url"
                value={formData.profile_image_url}
                onChange={(e) => setFormData({ ...formData, profile_image_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cover Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Image URL
              </label>
              <input
                type="url"
                value={formData.cover_image_url}
                onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Linked Hashtags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHashtag())}
                  placeholder="Add hashtag"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddHashtag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.linked_hashtags.map((hashtag) => (
                  <span
                    key={hashtag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    #{hashtag}
                    <button
                      type="button"
                      onClick={() => handleRemoveHashtag(hashtag)}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

#### Task 4.5.4: Add Edit Button to Community Detail Page
**File:** `src/app/community/[slug]/page.tsx` (modify existing file)

Add edit functionality to the community detail page:

```typescript
// Add state for modal
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

// Add save handler
const handleSaveCommunity = async (data: Community) => {
  if (!community?.id) return;
  
  const response = await fetch(`/api/communities/${community.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Failed to update community');
  }
  
  // Refresh page to show updated data
  window.location.reload();
};

// Add edit button in header section (after stats, before links)
<div className="flex gap-3 mt-4">
  <button
    onClick={() => setIsEditModalOpen(true)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Edit Community
  </button>
</div>

// Add modal import and component at bottom of JSX
import { CommunityEditModal } from '../../components/CommunityEditModal';

// ... in the JSX, after the closing divs:
{isEditModalOpen && community && (
  <CommunityEditModal
    community={community}
    isOpen={isEditModalOpen}
    onClose={() => setIsEditModalOpen(false)}
    onSave={handleSaveCommunity}
  />
)}
```

#### Task 4.5.5: Update Types to Support Editing
**File:** `src/app/types/data.ts` (modify existing file)

The Community interface already exists with all necessary fields. No changes needed unless we want to add additional validation or computed properties.

---

### Phase 5: Testing & Validation (2-3 hours)

#### Task 5.1: Database Testing
**File:** `scripts/test-communities.sql` (new file)

```sql
-- Test 1: Create a test community
INSERT INTO communities (name, slug, description, linked_hashtags)
VALUES ('Test Community', 'test-community', 'Test description', ARRAY['nihad', 'edit']);

-- Test 2: Verify backfill
SELECT backfill_community('{community_id}');

-- Test 3: Check totals
SELECT total_videos, total_views, total_creators FROM communities WHERE slug = 'test-community';

-- Test 4: Verify video memberships
SELECT COUNT(*) FROM community_video_memberships WHERE community_id = '{community_id}';

-- Test 5: Verify creator memberships
SELECT COUNT(*) FROM community_creator_memberships WHERE community_id = '{community_id}';

-- Test 6: Verify hashtag memberships
SELECT COUNT(*) FROM community_hashtag_memberships WHERE community_id = '{community_id}';
```

#### Task 5.2: Integration Testing Checklist
- [ ] Create a community with hashtags
- [ ] Verify backfill populates memberships
- [ ] Ingest a new video matching hashtags
- [ ] Verify video appears in community
- [ ] **Community Editing Tests:**
  - [ ] Open community detail page and click "Edit Community" button
  - [ ] Verify modal opens with current community data
  - [ ] Update community name and description
  - [ ] Add a new hashtag to existing community
  - [ ] Verify new videos with added hashtag are automatically added
  - [ ] Remove a hashtag from existing community
  - [ ] Verify videos with NO matching hashtags are removed
  - [ ] Verify videos with OTHER matching hashtags remain in community
  - [ ] Verify multi-hashtag videos stay even if one hashtag is removed
  - [ ] Update profile and cover image URLs
  - [ ] Save changes and verify page updates
  - [ ] Verify hashtag overlap prevention (no duplicate videos)
  - [ ] Test error handling on failed saves
- [ ] Test search and filters
- [ ] Test pagination
- [ ] Test responsive design
- [ ] Verify navigation links work

#### Task 5.3: Performance Testing
- [ ] Test with communities containing 1000+ videos
- [ ] Verify query performance (< 1s)
- [ ] Test concurrent ingestion with multiple communities
- [ ] Verify delta updates are efficient
- [ ] Check index usage with EXPLAIN ANALYZE

---

## Implementation Order

### Step 1: Database Foundation (1 day)
1. Run SQL migration to create tables
2. Create helper functions
3. Test database functions with sample data
4. Verify indexes are working

### Step 2: API Development (1 day)
1. Create communities list API
2. Create community detail API
3. Create videos/creators/hashtags APIs
4. Test APIs with Postman/curl

### Step 3: Frontend Foundation (1 day)
1. Add TypeScript types
2. Create hooks
3. Build community card component
4. Test data flow

### Step 4: Page Implementation (1 day)
1. Create communities index page
2. Create community detail page
3. Add navigation links
4. Test responsive layout

### Step 5: Integration & Testing (1 day)
1. Integrate ingestion updates
2. Test full workflow
3. Fix bugs and edge cases
4. Performance optimization

**Total Estimated Time: 5 days**

---

## Files to Create

### SQL
- `sql/017_communities.sql` - Tables, functions, and indexes

### API Routes
- `src/app/api/communities/route.ts` - List and create communities
- `src/app/api/communities/[id]/route.ts` - Get and update community
- `src/app/api/communities/[id]/videos/route.ts` - Community videos
- `src/app/api/communities/[id]/creators/route.ts` - Community creators
- `src/app/api/communities/[id]/hashtags/route.ts` - Community hashtags

### Components
- `src/app/components/CommunityCard.tsx` - Community card component
- `src/app/components/CommunityEditModal.tsx` - Community edit modal with form

### Pages
- `src/app/communities/page.tsx` - Communities index
- `src/app/community/[slug]/page.tsx` - Community detail

### Scripts
- `scripts/test-communities.sql` - Test queries
- `scripts/backfill-all-communities.sql` - Backfill script

---

## Files to Modify

### Types
- `src/app/types/data.ts` - Add community types

### Hooks
- `src/app/hooks/useData.ts` - Add community hooks

### Ingestion
- `sql/011_ingestion_v2.sql` - Add community membership updates

### API Routes
- `src/app/api/communities/[id]/route.ts` - Update PATCH handler to use smart sync

### Pages
- `src/app/community/[slug]/page.tsx` - Add edit button and modal integration

### SQL Functions
- `sql/017_communities.sql` - Add `sync_community_hashtags` function

### Navigation
- `src/app/components/Header.tsx` - Add Communities link

---

## Database Schema Summary

### Tables
1. `communities` - Main community data
2. `community_video_memberships` - Video memberships
3. `community_creator_memberships` - Creator memberships with aggregates
4. `community_hashtag_memberships` - Hashtag memberships with aggregates

### Key Indexes
- `communities.slug` - Unique lookup
- `communities.linked_hashtags` - GIN index for array overlap
- `community_video_memberships(community_id, video_id)` - Membership lookup
- `community_creator_memberships(community_id, creator_id)` - Membership lookup
- `community_hashtag_memberships(community_id, hashtag)` - Membership lookup

### Key Functions
- `check_video_community_match()` - Check if video matches community
- `update_community_video_membership()` - Update membership on video change
- `update_community_totals()` - Recalculate totals
- `backfill_community()` - Backfill existing videos
- `sync_community_hashtags()` - Smart sync when hashtags are added/removed (prevents duplicate videos, only removes videos with no matching hashtags)

---

## Success Criteria

✅ Communities can be created with hashtag arrays  
✅ Backfill populates initial memberships from existing videos  
✅ New videos automatically join matching communities  
✅ Totals update in real-time with view count changes  
✅ Search, sort, and filters work correctly  
✅ Videos, creators, and hashtags are ranked by community views  
✅ **Community Editing Feature:**
  - ✅ Users can click "Edit Community" button on detail page
  - ✅ Modal opens with all current community data pre-filled
  - ✅ Users can update name, description, profile image, and cover image
  - ✅ Users can add new hashtags which automatically backfill matching videos
  - ✅ Users can remove hashtags which intelligently removes ONLY videos with NO matching hashtags
  - ✅ Videos with multiple matching hashtags stay even when one is removed
  - ✅ No duplicate videos are added during backfill
  - ✅ All changes are saved and page updates immediately
✅ Memberships update correctly when hashtags change  
✅ Community with 1000+ videos performs well  
✅ Navigation and routing work correctly  
✅ Responsive design works on all devices  

---

## Notes

- Communities are **multi-hashtag collections** - videos match if ANY hashtag matches
- When a video's hashtags change, it may join or leave communities
- Totals are calculated from `views_count` in `videos_hot` (hot data)
- Delta updates happen on every video ingest (positive deltas only)
- Backfill jobs can be run periodically to fix drift
- Communities can share videos if hashtags overlap
- All hashtags are normalized (lowercase, no #)
- **Smart Hashtag Removal**: When removing hashtags, the system checks each video in the community and only removes those that have ZERO matching hashtags. Videos with multiple matching hashtags remain even if one of their hashtags is removed.
- **Overlap Prevention**: When adding hashtags, the backfill process checks for existing membership before adding, preventing duplicate entries.

---

## Future Enhancements

1. **User-Generated Communities**: Allow authenticated users to create their own communities
2. **Featured Communities**: Promote popular or curated communities
3. **Community Analytics**: Track growth, engagement trends
4. **Notifications**: Notify users when new content is added to followed communities
5. **Community Moderation**: Tools for community owners to manage content
6. **Related Communities**: Suggest similar communities based on hashtag overlap
7. **Community Search**: Search within community content
8. **Export**: Download community data/reports

---

## References

- Existing hashtag detail page: `src/app/hashtag/[tag]/page.tsx`
- Existing sound detail page: `src/app/sound/[soundId]/page.tsx`
- Fact tables schema: `sql/010_fact_tables.sql`
- Ingestion function: `sql/011_ingestion_v2.sql`
- Filter components: `src/app/components/filters/`

