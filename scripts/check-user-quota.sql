-- Check current quota status for a user
-- Replace the email with your test user's email

SELECT 
  p.id,
  p.email,
  p.role,
  COALESCE(uq.video_submissions, 0) as video_submissions,
  uq.date as quota_date,
  uq.updated_at,
  CASE p.role
    WHEN 'standard' THEN 1
    WHEN 'creator' THEN 10
    WHEN 'brand' THEN 5
    WHEN 'admin' THEN 999999
    ELSE 0
  END as limit,
  CASE p.role
    WHEN 'standard' THEN 1 - COALESCE(uq.video_submissions, 0)
    WHEN 'creator' THEN 10 - COALESCE(uq.video_submissions, 0)
    WHEN 'brand' THEN 5 - COALESCE(uq.video_submissions, 0)
    WHEN 'admin' THEN 999999
    ELSE 0
  END as remaining
FROM profiles p
LEFT JOIN user_daily_quotas uq ON uq.user_id = p.id 
  AND uq.date = CURRENT_DATE
WHERE p.email = 'contact@momenta.app'  -- CHANGE THIS EMAIL
ORDER BY uq.date DESC;

