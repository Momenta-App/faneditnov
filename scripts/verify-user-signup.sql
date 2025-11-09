-- Verify User Signup
-- Run this after signing up to check if everything worked correctly

-- 1. Check auth.users table (replace with your email)
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'everett@momenta.app'  -- Replace with your email
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check profiles table (should match auth.users)
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.email_verified,
  p.created_at,
  p.updated_at,
  u.email_confirmed_at as auth_email_confirmed
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.email = 'YOUR_EMAIL_HERE'  -- Replace with your email
ORDER BY p.created_at DESC
LIMIT 5;

-- 3. Check all recent profiles (last 10 signups)
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.email_verified,
  p.created_at,
  u.email_confirmed_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 4. Verify trigger worked (check if profile was created automatically)
SELECT 
  'Trigger Status' as check_type,
  COUNT(*) as total_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM profiles) THEN '✅ All users have profiles'
    ELSE '⚠️ Some users missing profiles'
  END as status
FROM auth.users;

-- 5. Check role distribution
SELECT 
  role,
  COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

