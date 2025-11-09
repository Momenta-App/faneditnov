-- Test the quota function directly
-- Replace with your test user's ID or email

-- Option 1: Test with user ID
SELECT get_user_quota_status(
  'b50ca3ef-8626-47cb-abec-6ce2deee8c3e'::uuid,  -- CHANGE THIS USER ID
  'standard'::text
) as quota_status;

-- Option 2: Test with email (get ID first)
SELECT get_user_quota_status(
  (SELECT id FROM profiles WHERE email = 'contact@momenta.app'),
  (SELECT role FROM profiles WHERE email = 'contact@momenta.app')
) as quota_status;

-- This should return:
-- {"limit": 1, "current": 0, "remaining": 1, "allowed": true, "date": "2025-01-29"}
-- If allowed is false when current is 0, there's a bug

