-- ============================================================================
-- STEP-BY-STEP: Convert role to ENUM for Supabase UI dropdown
-- Run each step separately, checking for errors before proceeding
-- ============================================================================

-- STEP 1: Find the CHECK constraint name (run this first and note the name)
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%role%';

-- STEP 2: Drop the CHECK constraint (replace <constraint_name> with the name from Step 1)
-- If no constraint found in Step 1, skip this step
-- ALTER TABLE profiles DROP CONSTRAINT <constraint_name>;

-- STEP 3: Drop ALL RLS policies that reference role
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Brand or admin can create communities" ON communities;
DROP POLICY IF EXISTS "Owner or admin can update communities" ON communities;
DROP POLICY IF EXISTS "Only admin can delete communities" ON communities;

-- STEP 4: Create enum type (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('standard', 'creator', 'brand', 'admin');
  END IF;
END $$;

-- STEP 5: Convert column type
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'standard'::user_role;

-- STEP 6: Recreate profiles policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- STEP 7: Recreate communities policies
CREATE POLICY "Brand or admin can create communities" ON communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text IN ('brand', 'admin')
    )
    AND created_by = auth.uid()
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

-- STEP 8: Verify it worked
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'role';

-- Expected result: data_type = 'USER-DEFINED', udt_name = 'user_role'

-- STEP 9: Test that data is preserved
SELECT email, role FROM profiles LIMIT 5;

