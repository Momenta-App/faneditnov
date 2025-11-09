-- Update RLS policies to restrict community creation and editing to admin only
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Brand or admin can create communities" ON communities;
DROP POLICY IF EXISTS "Owner or admin can update communities" ON communities;

-- Create new policies (admin only)
CREATE POLICY "Only admin can create communities" ON communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
    AND created_by = auth.uid() -- Must set self as owner
  );

CREATE POLICY "Only admin can update communities" ON communities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role::text = 'admin'
    )
  );

-- Delete policy already exists and is correct (admin only)
-- No change needed for DELETE policy

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'communities'
ORDER BY policyname;

