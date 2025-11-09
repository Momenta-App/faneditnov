-- Reset quota for a specific user (for testing)
-- Replace the email with your test user's email

-- Delete quota records for user
DELETE FROM user_daily_quotas
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'contact@momenta.app'  -- CHANGE THIS EMAIL
);

-- Verify quota is reset
SELECT 
  p.email,
  p.role,
  uq.video_submissions,
  uq.date,
  uq.updated_at
FROM profiles p
LEFT JOIN user_daily_quotas uq ON uq.user_id = p.id
WHERE p.email = 'contact@momenta.app'  -- CHANGE THIS EMAIL
ORDER BY uq.date DESC;

-- Expected: Should return empty (no quota records) or video_submissions = 0

