-- ============================================================================
-- RAW VIDEO OWNERSHIP + MP4 METADATA
-- ============================================================================
-- 1. raw_video_assets      -> stores uploaded MP4 metadata for both contests and
--                              general uploads (triggered via BrightData)
-- 2. video_ownership_claims -> tracks per-video ownership status so we can
--                              quickly determine whether a video already has a
--                              verified owner
-- 3. contest_submissions    -> new columns for MP4 ownership + fingerprint
-- ============================================================================

-- ============================================================================
-- PART 1: raw_video_assets TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS raw_video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('contest', 'general')),
  contest_submission_id INTEGER REFERENCES contest_submissions(id) ON DELETE CASCADE,
  submission_metadata_id TEXT REFERENCES submission_metadata(snapshot_id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  video_fingerprint TEXT GENERATED ALWAYS AS (md5(lower(video_url))) STORED,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  mp4_bucket TEXT NOT NULL,
  mp4_path TEXT NOT NULL,
  mp4_size_bytes BIGINT,
  mp4_duration_seconds INTEGER,
  mp4_uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  ownership_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    ownership_status IN ('pending', 'verified', 'failed', 'contested', 'not_required')
  ),
  ownership_reason TEXT,
  owner_social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  ownership_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_video_assets_user_id ON raw_video_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_video_assets_contest_id ON raw_video_assets(contest_submission_id);
CREATE INDEX IF NOT EXISTS idx_raw_video_assets_fingerprint ON raw_video_assets(video_fingerprint);
CREATE INDEX IF NOT EXISTS idx_raw_video_assets_status ON raw_video_assets(ownership_status);

ALTER TABLE raw_video_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own raw video assets" ON raw_video_assets;
CREATE POLICY "Users can read own raw video assets" ON raw_video_assets
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert raw video assets" ON raw_video_assets;
CREATE POLICY "Users can insert raw video assets" ON raw_video_assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own raw video assets" ON raw_video_assets;
CREATE POLICY "Users can update own raw video assets" ON raw_video_assets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages raw video assets" ON raw_video_assets;
CREATE POLICY "Service role manages raw video assets" ON raw_video_assets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_raw_video_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raw_video_assets_updated_at ON raw_video_assets;
CREATE TRIGGER trg_raw_video_assets_updated_at
  BEFORE UPDATE ON raw_video_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_raw_video_assets_updated_at();

COMMENT ON TABLE raw_video_assets IS 'Stores uploaded MP4 metadata and ownership status for contests and general uploads';
COMMENT ON COLUMN raw_video_assets.video_fingerprint IS 'md5 hash of lowercase video URL used for ownership lookups';

-- ============================================================================
-- PART 2: video_ownership_claims TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_ownership_claims (
  video_fingerprint TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  current_owner_asset_id UUID REFERENCES raw_video_assets(id) ON DELETE SET NULL,
  current_owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_owner_social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (
    status IN ('unclaimed', 'pending', 'claimed', 'contested')
  ),
  contested_count INTEGER DEFAULT 0,
  last_contested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_ownership_claims_status ON video_ownership_claims(status);

ALTER TABLE video_ownership_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ownership claims" ON video_ownership_claims;
CREATE POLICY "Admins can read ownership claims" ON video_ownership_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role manages ownership claims" ON video_ownership_claims;
CREATE POLICY "Service role manages ownership claims" ON video_ownership_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_video_ownership_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_ownership_claims_updated_at ON video_ownership_claims;
CREATE TRIGGER trg_video_ownership_claims_updated_at
  BEFORE UPDATE ON video_ownership_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_video_ownership_claims_updated_at();

COMMENT ON TABLE video_ownership_claims IS 'Tracks ownership state per video fingerprint to prevent duplicate payouts';

-- ============================================================================
-- PART 3: contest_submissions column updates
-- ============================================================================

ALTER TABLE contest_submissions
  ADD COLUMN IF NOT EXISTS raw_video_asset_id UUID REFERENCES raw_video_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mp4_ownership_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    mp4_ownership_status IN ('pending', 'verified', 'failed', 'contested', 'not_uploaded')
  ),
  ADD COLUMN IF NOT EXISTS mp4_ownership_reason TEXT,
  ADD COLUMN IF NOT EXISTS mp4_owner_social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mp4_uploaded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownership_contested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ownership_resolved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_submissions' AND column_name = 'video_fingerprint'
  ) THEN
    EXECUTE $create$
      ALTER TABLE contest_submissions
      ADD COLUMN video_fingerprint TEXT GENERATED ALWAYS AS (md5(lower(original_video_url))) STORED;
    $create$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contest_submissions_fingerprint ON contest_submissions(video_fingerprint);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_mp4_status ON contest_submissions(mp4_ownership_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_raw_asset_id ON contest_submissions(raw_video_asset_id);

COMMENT ON COLUMN contest_submissions.raw_video_asset_id IS 'Reference to raw_video_assets record storing MP4 metadata';
COMMENT ON COLUMN contest_submissions.mp4_ownership_status IS 'Ownership state: pending until social account verification proves ownership';
COMMENT ON COLUMN contest_submissions.video_fingerprint IS 'md5 hash of normalized video URL for duplicate/ownership checks';


