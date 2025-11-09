-- Simple fix: Create profile for existing user
-- Run this to create your missing profile

INSERT INTO profiles (id, email, role, email_verified)
SELECT 
  id,
  email,
  'standard',
  COALESCE(email_confirmed_at IS NOT NULL, false)
FROM auth.users
WHERE email = 'everett@momenta.app'
AND id NOT IN (SELECT id FROM profiles);

-- Verify it worked
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.email_verified,
  p.created_at
FROM profiles p
WHERE p.email = 'everett@momenta.app';

