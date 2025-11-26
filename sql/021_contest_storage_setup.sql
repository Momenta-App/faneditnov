-- ============================================================================
-- CONTEST STORAGE SETUP
-- ============================================================================
-- This migration sets up the contest-videos storage bucket and policies
-- ============================================================================

-- Create contest-videos bucket (if it doesn't exist)
-- Note: Bucket creation must be done via Supabase Dashboard or Storage API
-- This SQL assumes the bucket exists and sets up policies
-- If you encounter "must be owner of relation objects" errors while running
-- this script, create the policies below via Storage → Policies in the
-- Supabase Dashboard for the `contest-videos` bucket (the storage owner role
-- must execute CREATE POLICY). Re-running this migration afterwards keeps the
-- documentation/comments in sync even if the policies already exist.

-- ============================================================================
-- ============================================================================
-- Public read access (create only if policy doesn't already exist)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public read access - approved contest videos'
      AND tablename = 'objects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read access - approved contest videos"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'contest-videos'
      );
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Authenticated users can upload (only if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can upload own contest videos'
      AND tablename = 'objects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can upload own contest videos"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'contest-videos'
        AND auth.role() = 'authenticated'
        -- Path structure: {contest_id}/{user_id}/{filename}
        -- Users can only upload to their own folder (second folder in path)
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Authenticated users can update (only if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can update own contest videos'
      AND tablename = 'objects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update own contest videos"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'contest-videos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Authenticated users can delete (only if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete own contest videos'
      AND tablename = 'objects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own contest videos"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'contest-videos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Admins can manage all videos (only if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admins can manage all contest videos'
      AND tablename = 'objects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can manage all contest videos"
      ON storage.objects FOR ALL
      USING (
        bucket_id = 'contest-videos'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        bucket_id = 'contest-videos'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
    $policy$;
  END IF;
END $$;

COMMENT ON POLICY "Public read access - approved contest videos" ON storage.objects IS 
'Allows public read access to contest videos for display on contest pages';

COMMENT ON POLICY "Users can upload own contest videos" ON storage.objects IS 
'Allows authenticated users to upload videos to their own folder in contest-videos bucket';

