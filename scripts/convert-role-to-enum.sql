-- Convert profiles.role from TEXT to ENUM for dropdown in Supabase UI
-- This requires dropping and recreating RLS policies

-- Step 1: Create enum type (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('standard', 'creator', 'brand', 'admin');
  END IF;
END $$;

-- Step 2: Drop ALL RLS policies that reference role column
-- Profiles policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Communities policies (all reference profiles.role)
DROP POLICY IF EXISTS "Brand or admin can create communities" ON communities;
DROP POLICY IF EXISTS "Owner or admin can update communities" ON communities;
DROP POLICY IF EXISTS "Only admin can delete communities" ON communities;

-- Step 3: Convert column type
-- First, drop the CHECK constraint (find exact name first if needed)
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find and drop any CHECK constraint on role column
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
  END LOOP;
END $$;

-- Drop default before converting
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

-- Convert to enum
ALTER TABLE profiles
  ALTER COLUMN role TYPE user_role
  USING role::user_role;

-- Set new default
ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'standard'::user_role;

-- Step 4: Recreate RLS policies
-- Profiles policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Note: Role updates should be done via service role/admin API
    -- Users can update other fields but role changes require admin
  );

-- Communities policies
CREATE POLICY "Brand or admin can create communities" ON communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text IN ('brand', 'admin')
    )
    AND created_by = auth.uid() -- Must set self as owner
  );

CREATE POLICY "Owner or admin can update communities" ON communities
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
  );

CREATE POLICY "Only admin can delete communities" ON communities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
  );

-- Step 5: Verify the conversion
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'role';

-- Expected: data_type should be 'USER-DEFINED', udt_name should be 'user_role'

-- Step 6: Verify existing data is preserved
SELECT email, role::text FROM profiles LIMIT 5;

