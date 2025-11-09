-- Create profile for user: 7ff12ef5-2c24-40ee-b66a-18a1165bb433
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  v_user_id uuid := '7ff12ef5-2c24-40ee-b66a-18a1165bb433';
  v_email text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;
  
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;
  
  -- Create profile if it doesn't exist
  INSERT INTO profiles (id, email, role, email_verified)
  VALUES (
    v_user_id,
    v_email,
    'standard',
    EXISTS(SELECT 1 FROM auth.users WHERE id = v_user_id AND email_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified;
  
  RAISE NOTICE 'Profile created/updated for user: % (email: %)', v_user_id, v_email;
END $$;

-- Verify
SELECT 
  p.id,
  p.email,
  p.role,
  p.email_verified,
  au.email_confirmed_at IS NOT NULL as auth_confirmed
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE p.id = '7ff12ef5-2c24-40ee-b66a-18a1165bb433';

