-- Copy this entire script into Supabase SQL Editor
-- Creates profile for your existing user

-- Step 1: Create the profile
INSERT INTO profiles (id, email, role, email_verified)
SELECT 
  id,
  email,
  'standard',
  COALESCE(email_confirmed_at IS NOT NULL, false)
FROM auth.users
WHERE email = 'everett@momenta.app'
AND id NOT IN (SELECT id FROM profiles);

-- Step 2: Verify it worked
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.email_verified,
  p.created_at,
  'Profile exists!' as status
FROM profiles p
WHERE p.email = 'everett@momenta.app';

