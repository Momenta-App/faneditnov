-- ============================================================================
-- IMAGE STORAGE SETUP - RLS POLICIES ONLY
-- Note: The bucket must be created via Supabase Dashboard or SQL Editor first
-- ============================================================================

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create bucket: "brightdata-results"
-- 3. Set as PUBLIC bucket
-- 4. Then run this SQL to set up policies

-- ============================================================================
-- STORAGE POLICIES
-- Set up RLS policies for public read and authenticated write access
-- ============================================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;

-- Public read access for all users
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'brightdata-results');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brightdata-results');

-- Allow service role full access (insert, update, delete)
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'brightdata-results')
WITH CHECK (bucket_id = 'brightdata-results');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify bucket exists
DO $$
DECLARE
  bucket_count INTEGER;
  bucket_public BOOLEAN;
BEGIN
  SELECT COUNT(*), BOOL_OR(public) INTO bucket_count, bucket_public
  FROM storage.buckets
  WHERE id = 'brightdata-results';
  
  IF bucket_count = 0 THEN
    RAISE EXCEPTION 'Bucket "brightdata-results" does not exist. Please create it via Supabase Dashboard → Storage first.';
  END IF;
  
  IF NOT bucket_public THEN
    RAISE WARNING 'Bucket "brightdata-results" is not public. Set it to public in Supabase Dashboard → Storage.';
  END IF;
  
  RAISE NOTICE '✓ Image storage bucket "brightdata-results" configured successfully with % policies', 
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%brightdata-results%');
END $$;

COMMENT ON SCHEMA storage IS 'Storage schema for file uploads. brightdata-results bucket stores TikTok images (covers, avatars)';
