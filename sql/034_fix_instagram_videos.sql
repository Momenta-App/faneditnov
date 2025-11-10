-- ============================================================================
-- FIX INSTAGRAM VIDEOS
-- This script fixes Instagram videos that may have issues with:
-- 1. post_id stored as numeric instead of shortcode
-- 2. Missing impact_score calculations
-- 3. Missing URL field
-- ============================================================================

-- Step 1: Ensure URL field is set correctly for Instagram videos
-- Update post_id to use shortcode from URL if available
-- NOTE: We're NOT updating video_id (primary key) to avoid foreign key constraint issues
-- The post_id is what's used for embeds, so that's what matters

-- First, update videos_cold if video_id needs to change (but we'll keep video_id as numeric for FK integrity)
-- Actually, let's keep video_id as the numeric ID for referential integrity
-- Only update post_id to shortcode for embeds

UPDATE videos_hot
SET 
  post_id = COALESCE(
    (regexp_match(url, 'instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)'))[2],
    post_id
  ),
  -- Ensure URL field is set (prefer existing url, but if missing and we have shortcode, construct it)
  url = COALESCE(
    url,
    CASE 
      WHEN post_id IS NOT NULL AND post_id !~ '^\d+$' THEN
        -- post_id is a shortcode, construct URL
        'https://www.instagram.com/p/' || post_id
      ELSE
        url
    END
  )
WHERE platform = 'instagram'
  AND (
    (url IS NOT NULL AND url LIKE '%instagram.com%' AND post_id ~ '^\d+$')
    OR (url IS NULL AND post_id IS NOT NULL AND post_id !~ '^\d+$')
  )
  AND (regexp_match(url, 'instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)'))[2] IS NOT NULL;

-- Step 2: Recalculate impact_score for all Instagram videos
-- The trigger should do this automatically, but let's force an update
UPDATE videos_hot
SET 
  impact_score = public.compute_impact(
    views_count,
    likes_count,
    comments_count,
    shares_count,
    COALESCE(collect_count, 0)
  ),
  impact_updated_at = NOW()
WHERE platform = 'instagram';

-- Step 3: Verify Instagram videos are in all required tables
-- Check videos_hot
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM videos_hot
  WHERE platform = 'instagram';
  
  RAISE NOTICE 'Instagram videos in videos_hot: %', v_count;
END $$;

-- Check creators_hot
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT creator_id) INTO v_count
  FROM videos_hot
  WHERE platform = 'instagram';
  
  RAISE NOTICE 'Instagram creators in creators_hot: %', v_count;
END $$;

-- Check hashtags (via video_hashtag_facts)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT vhf.hashtag) INTO v_count
  FROM video_hashtag_facts vhf
  INNER JOIN videos_hot v ON v.video_id = vhf.video_id
  WHERE v.platform = 'instagram';
  
  RAISE NOTICE 'Instagram hashtags in video_hashtag_facts: %', v_count;
END $$;

-- Step 4: Show sample Instagram video data for verification
SELECT 
  video_id,
  post_id,
  url,
  platform,
  views_count,
  likes_count,
  comments_count,
  shares_count,
  impact_score,
  created_at
FROM videos_hot
WHERE platform = 'instagram'
ORDER BY created_at DESC
LIMIT 5;

