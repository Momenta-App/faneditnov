-- Setup script to enable bulk upload for dev environment
-- This script will:
-- 1. Check your current user role
-- 2. Make you an admin if you're not already
-- 3. Verify the setup

-- ============================================================================
-- Step 1: Check current setup
-- ============================================================================

-- See all users and their roles
SELECT 
  au.email,
  p.role,
  p.display_name,
  p.created_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY p.created_at DESC;

-- ============================================================================
-- Step 2: Make yourself an admin (UPDATE THE EMAIL BELOW)
-- ============================================================================

-- IMPORTANT: Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'admin'
WHERE email = 'your-email@example.com'
RETURNING id, email, role, display_name;

-- ============================================================================
-- Step 3: Verify the change
-- ============================================================================

-- Check that you're now an admin
SELECT 
  id, 
  email, 
  role, 
  display_name,
  created_at
FROM profiles 
WHERE role = 'admin';

-- ============================================================================
-- Step 4: Check quota status (optional)
-- ============================================================================

-- See your current quota (admins should have unlimited)
SELECT 
  p.id,
  p.email,
  p.role,
  COALESCE(uq.video_submissions, 0) as submissions_today,
  CASE p.role
    WHEN 'admin' THEN 999999
    WHEN 'creator' THEN 10
    WHEN 'brand' THEN 5
    WHEN 'standard' THEN 1
  END as daily_limit
FROM profiles p
LEFT JOIN user_daily_quotas uq ON uq.user_id = p.id 
  AND uq.date = CURRENT_DATE
WHERE p.email = 'your-email@example.com'  -- UPDATE THIS
ORDER BY uq.date DESC
LIMIT 1;

