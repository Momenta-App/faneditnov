-- Test Communities API
-- Run this in Supabase SQL Editor to debug

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'communities'
);

-- 2. Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'communities'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'communities';

-- 4. Try selecting data
SELECT * FROM communities LIMIT 5;

-- 5. Create a test community if none exist
INSERT INTO communities (name, slug, description, linked_hashtags)
VALUES (
  'Test Community', 
  'test-community', 
  'A test community for debugging',
  ARRAY['edit', 'test']
)
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug;

-- 6. Run backfill for the test community (replace with actual ID from step 5)
-- SELECT backfill_community('actual-uuid-here');

-- 7. Verify membership tables exist
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'community_video_memberships');
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'community_creator_memberships');
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'community_hashtag_memberships');

