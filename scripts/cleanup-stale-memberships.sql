-- Cleanup script for stale community memberships
-- Run this once to clean up existing data with video_count = 0

-- Delete creator memberships with 0 videos
DELETE FROM community_creator_memberships WHERE video_count = 0;

-- Delete hashtag memberships with 0 videos
DELETE FROM community_hashtag_memberships WHERE video_count = 0;

-- Recalculate total_creators for all communities
UPDATE communities SET 
  total_creators = (
    SELECT COUNT(DISTINCT creator_id)
    FROM community_creator_memberships
    WHERE community_id = communities.id AND video_count > 0
  );

-- Verify the cleanup
SELECT 
  c.id,
  c.name,
  c.total_creators,
  COUNT(DISTINCT ccm.creator_id) as actual_creator_count,
  COUNT(DISTINCT CASE WHEN ccm.video_count > 0 THEN ccm.creator_id END) as creators_with_videos
FROM communities c
LEFT JOIN community_creator_memberships ccm ON ccm.community_id = c.id
GROUP BY c.id, c.name, c.total_creators;

