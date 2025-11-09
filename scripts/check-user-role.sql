-- Check user role in profiles table
-- Replace the email below with your test user's email

SELECT 
  au.id as auth_user_id,
  au.email,
  au.role as auth_role,  -- This is Supabase's internal role (should be "authenticated")
  p.id as profile_id,
  p.role as app_role,    -- This is OUR application role (standard/creator/brand/admin)
  p.display_name,
  p.email_verified,
  p.created_at as profile_created_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'contact@momenta.app';  -- CHANGE THIS EMAIL

-- Expected result:
-- auth_role: "authenticated" ✅ (this is correct - Supabase's internal role)
-- app_role: "standard" ✅ (this is what we use for access control)

