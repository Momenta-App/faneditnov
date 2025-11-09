-- Fix Trigger to NOT Fail User Creation
-- The trigger was causing signup to fail. This version won't break signups.

-- Drop and recreate with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to create profile, but don't fail if it errors
  BEGIN
    INSERT INTO profiles (id, email, role, email_verified)
    VALUES (
      NEW.id,
      NEW.email,
      'standard',
      COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    -- The signup API route will create the profile as fallback
    RAISE WARNING 'Failed to auto-create profile for user %: %', NEW.id, SQLERRM;
    -- Don't re-raise - allow user creation to succeed
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Verify
SELECT 
  trigger_name,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

