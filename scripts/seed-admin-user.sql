-- Script to seed an admin user
-- Usage: Update the email below to match your admin account, then run this script
-- This assumes the user has already signed up via the app (profile created by trigger)

-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email
-- The user must exist in auth.users first (sign up via the app or Supabase dashboard)

-- Step 1: Find the user ID (optional - uncomment to see)
-- SELECT id, email FROM auth.users WHERE email = 'your-admin-email@example.com';

-- Step 2: Update role to admin
UPDATE profiles 
SET role = 'admin'
WHERE email = 'your-admin-email@example.com'
RETURNING id, email, role;

-- Verify the update
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'admin';

