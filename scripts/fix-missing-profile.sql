-- Fix Missing Profile
-- Run this to create a profile for a user that exists in auth.users but not in profiles

-- IMPORTANT: Update the email below
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- Set the email of the user who needs a profile
  v_email := 'everett@momenta.app';
  
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', v_email;
    RETURN;
  END IF;
  
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
    RAISE NOTICE 'Profile already exists for user %', v_email;
    RETURN;
  END IF;
  
  -- Create the profile
  INSERT INTO profiles (id, email, role, email_verified)
  SELECT 
    id,
    email,
    'standard',
    COALESCE(email_confirmed_at IS NOT NULL, false)
  FROM auth.users
  WHERE id = v_user_id;
  
  RAISE NOTICE 'Profile created successfully for user %', v_email;
END $$;

-- Verify the profile was created
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.email_verified,
  p.created_at,
  u.email_confirmed_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'everett@momenta.app';

