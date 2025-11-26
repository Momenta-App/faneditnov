-- ============================================================================
-- CONTESTS SYSTEM MIGRATION
-- ============================================================================
-- This migration adds:
-- 1. contests table (admin-created fan edit contests)
-- 2. contest_prizes table (prizes for each contest)
-- 3. contest_submissions table (user submissions to contests)
-- 4. social_accounts table (connected social media accounts for verification)
-- 5. RLS policies for all tables
-- 6. Indexes for performance
-- ============================================================================

-- ============================================================================
-- PART 1: SOCIAL ACCOUNTS TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  profile_url TEXT NOT NULL,
  username TEXT, -- Extracted from URL for display
  verification_code TEXT NOT NULL, -- Verification code for bio check
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
  profile_data JSONB, -- Full scraped profile data from Bright Data
  snapshot_id TEXT, -- BrightData snapshot ID for verification
  webhook_status TEXT DEFAULT 'PENDING' CHECK (webhook_status IN ('PENDING', 'COMPLETED', 'FAILED')),
  last_verification_attempt_at TIMESTAMPTZ,
  verification_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, profile_url) -- Prevent duplicate links
);

-- Indexes for social_accounts
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_verification_status ON social_accounts(verification_status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_verification_code ON social_accounts(verification_code);
CREATE INDEX IF NOT EXISTS idx_social_accounts_snapshot_id ON social_accounts(snapshot_id) WHERE snapshot_id IS NOT NULL;

-- Enable RLS for social_accounts
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_accounts
DROP POLICY IF EXISTS "Users can read own social accounts" ON social_accounts;
CREATE POLICY "Users can read own social accounts" ON social_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own social accounts" ON social_accounts;
CREATE POLICY "Users can insert own social accounts" ON social_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own social accounts" ON social_accounts;
CREATE POLICY "Users can update own social accounts" ON social_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own social accounts" ON social_accounts;
CREATE POLICY "Users can delete own social accounts" ON social_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all social accounts" ON social_accounts;
CREATE POLICY "Admins can read all social accounts" ON social_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at on social_accounts
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER trigger_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_accounts_updated_at();

-- ============================================================================
-- PART 2: CONTESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  movie_identifier TEXT, -- Identifier for the movie/project
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'closed')),
  required_hashtags TEXT[] NOT NULL DEFAULT '{}',
  required_description_template TEXT, -- Optional pattern/template for description validation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_date < end_date)
);

-- Indexes for contests
CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_movie_identifier ON contests(movie_identifier) WHERE movie_identifier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contests_created_by ON contests(created_by);
CREATE INDEX IF NOT EXISTS idx_contests_start_date ON contests(start_date);
CREATE INDEX IF NOT EXISTS idx_contests_end_date ON contests(end_date);
CREATE INDEX IF NOT EXISTS idx_contests_created_at ON contests(created_at DESC);

-- Enable RLS for contests
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contests
-- Public can read contests
DROP POLICY IF EXISTS "Public can read contests" ON contests;
CREATE POLICY "Public can read contests" ON contests
  FOR SELECT
  USING (true);

-- Only admins can insert contests
DROP POLICY IF EXISTS "Admins can create contests" ON contests;
CREATE POLICY "Admins can create contests" ON contests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND created_by = auth.uid()
  );

-- Only admins can update contests
DROP POLICY IF EXISTS "Admins can update contests" ON contests;
CREATE POLICY "Admins can update contests" ON contests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete contests
DROP POLICY IF EXISTS "Admins can delete contests" ON contests;
CREATE POLICY "Admins can delete contests" ON contests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at on contests
CREATE OR REPLACE FUNCTION update_contests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contests_updated_at ON contests;
CREATE TRIGGER trigger_contests_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION update_contests_updated_at();

-- ============================================================================
-- PART 3: CONTEST PRIZES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contest_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "First Prize", "Second Prize"
  description TEXT,
  payout_amount DECIMAL(10,2) NOT NULL CHECK (payout_amount >= 0),
  rank_order INTEGER NOT NULL CHECK (rank_order > 0), -- 1 = first, 2 = second, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contest_prizes
CREATE INDEX IF NOT EXISTS idx_contest_prizes_contest_id ON contest_prizes(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_prizes_rank_order ON contest_prizes(contest_id, rank_order);

-- Enable RLS for contest_prizes
ALTER TABLE contest_prizes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contest_prizes
-- Public can read prizes
DROP POLICY IF EXISTS "Public can read contest prizes" ON contest_prizes;
CREATE POLICY "Public can read contest prizes" ON contest_prizes
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete prizes
DROP POLICY IF EXISTS "Admins can manage contest prizes" ON contest_prizes;
CREATE POLICY "Admins can manage contest prizes" ON contest_prizes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at on contest_prizes
CREATE OR REPLACE FUNCTION update_contest_prizes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contest_prizes_updated_at ON contest_prizes;
CREATE TRIGGER trigger_contest_prizes_updated_at
  BEFORE UPDATE ON contest_prizes
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_prizes_updated_at();

-- ============================================================================
-- PART 4: CONTEST SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contest_submissions (
  id SERIAL PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  original_video_url TEXT NOT NULL,
  mp4_bucket TEXT, -- Supabase storage bucket name
  mp4_path TEXT, -- Storage path to MP4 file
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  video_id TEXT, -- Extracted from URL
  hashtag_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (hashtag_status IN ('pass', 'fail', 'pending_review', 'approved_manual')),
  description_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (description_status IN ('pass', 'fail', 'pending_review', 'approved_manual')),
  content_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (content_review_status IN ('pending', 'approved', 'rejected')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  impact_score NUMERIC(18,2) DEFAULT 0, -- Computed via compute_impact() function
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  stats_updated_at TIMESTAMPTZ,
  last_stats_refresh_at TIMESTAMPTZ, -- For daily refresh limit
  is_disqualified BOOLEAN DEFAULT FALSE,
  invalid_stats_flag BOOLEAN DEFAULT FALSE,
  processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'fetching_stats', 'checking_hashtags', 'checking_description', 'waiting_review', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate submissions to same contest
  UNIQUE(contest_id, user_id, original_video_url)
);

-- Indexes for contest_submissions
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_id ON contest_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_user_id ON contest_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_social_account_id ON contest_submissions(social_account_id) WHERE social_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contest_submissions_processing_status ON contest_submissions(processing_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_impact_score ON contest_submissions(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_hashtag_status ON contest_submissions(hashtag_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_description_status ON contest_submissions(description_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_content_review_status ON contest_submissions(content_review_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_verification_status ON contest_submissions(verification_status);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_platform ON contest_submissions(platform);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_created_at ON contest_submissions(created_at DESC);
-- Index for preventing duplicate video URLs across contests for same movie
CREATE INDEX IF NOT EXISTS idx_contest_submissions_original_url ON contest_submissions(original_video_url);

-- Enable RLS for contest_submissions
ALTER TABLE contest_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contest_submissions
-- Users can read their own submissions
DROP POLICY IF EXISTS "Users can read own submissions" ON contest_submissions;
CREATE POLICY "Users can read own submissions" ON contest_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Public can read approved submissions
DROP POLICY IF EXISTS "Public can read approved submissions" ON contest_submissions;
CREATE POLICY "Public can read approved submissions" ON contest_submissions
  FOR SELECT
  USING (content_review_status = 'approved' AND processing_status = 'approved');

-- Users can insert their own submissions
DROP POLICY IF EXISTS "Users can insert own submissions" ON contest_submissions;
CREATE POLICY "Users can insert own submissions" ON contest_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update limited fields on their own submissions
DROP POLICY IF EXISTS "Users can update own submissions" ON contest_submissions;
CREATE POLICY "Users can update own submissions" ON contest_submissions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Users can only update certain fields (handled in application logic)
  );

-- Admins can read all submissions
DROP POLICY IF EXISTS "Admins can read all submissions" ON contest_submissions;
CREATE POLICY "Admins can read all submissions" ON contest_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all submissions
DROP POLICY IF EXISTS "Admins can update all submissions" ON contest_submissions;
CREATE POLICY "Admins can update all submissions" ON contest_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at on contest_submissions
CREATE OR REPLACE FUNCTION update_contest_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contest_submissions_updated_at ON contest_submissions;
CREATE TRIGGER trigger_contest_submissions_updated_at
  BEFORE UPDATE ON contest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_submissions_updated_at();

-- ============================================================================
-- PART 5: FUNCTION TO UPDATE IMPACT SCORE ON SUBMISSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contest_submission_impact()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate impact score using existing compute_impact function
  NEW.impact_score := public.compute_impact(
    COALESCE(NEW.views_count, 0),
    COALESCE(NEW.likes_count, 0),
    COALESCE(NEW.comments_count, 0),
    COALESCE(NEW.shares_count, 0),
    COALESCE(NEW.saves_count, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update impact score when stats change
DROP TRIGGER IF EXISTS trg_contest_submissions_set_impact ON contest_submissions;
CREATE TRIGGER trg_contest_submissions_set_impact
  BEFORE INSERT OR UPDATE OF views_count, likes_count, comments_count, shares_count, saves_count
  ON contest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_submission_impact();

-- ============================================================================
-- PART 6: FUNCTION TO AUTO-TRANSITION CONTEST STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contest_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-transition contest status based on dates
  IF NEW.status = 'upcoming' AND NEW.start_date <= NOW() THEN
    NEW.status := 'live';
  END IF;
  
  IF NEW.status = 'live' AND NEW.end_date <= NOW() THEN
    NEW.status := 'closed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update contest status
DROP TRIGGER IF EXISTS trg_contests_update_status ON contests;
CREATE TRIGGER trg_contests_update_status
  BEFORE INSERT OR UPDATE OF start_date, end_date, status
  ON contests
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_status();

-- ============================================================================
-- PART 7: FUNCTION TO CHECK DUPLICATE VIDEO ACROSS CONTESTS FOR SAME MOVIE
-- ============================================================================

CREATE OR REPLACE FUNCTION check_duplicate_video_across_movie_contests(
  p_user_id UUID,
  p_video_url TEXT,
  p_contest_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_movie_identifier TEXT;
  v_duplicate_exists BOOLEAN;
BEGIN
  -- Get movie identifier for the contest
  SELECT movie_identifier INTO v_movie_identifier
  FROM contests
  WHERE id = p_contest_id;

  -- If no movie identifier, allow submission (no cross-contest restriction)
  IF v_movie_identifier IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if same video URL exists in another contest for same movie
  SELECT EXISTS(
    SELECT 1
    FROM contest_submissions cs
    JOIN contests c ON c.id = cs.contest_id
    WHERE cs.user_id = p_user_id
      AND cs.original_video_url = p_video_url
      AND c.movie_identifier = v_movie_identifier
      AND cs.contest_id != p_contest_id
  ) INTO v_duplicate_exists;

  RETURN v_duplicate_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_duplicate_video_across_movie_contests IS 
'Checks if a video URL has already been submitted to another contest for the same movie';

-- ============================================================================
-- PART 8: FUNCTION TO CHECK DAILY STATS REFRESH LIMIT
-- ============================================================================

CREATE OR REPLACE FUNCTION can_refresh_stats(p_submission_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_refresh TIMESTAMPTZ;
  v_hours_since_refresh NUMERIC;
BEGIN
  -- Get last refresh timestamp
  SELECT last_stats_refresh_at INTO v_last_refresh
  FROM contest_submissions
  WHERE id = p_submission_id;

  -- If never refreshed, allow
  IF v_last_refresh IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if 24 hours have passed
  v_hours_since_refresh := EXTRACT(EPOCH FROM (NOW() - v_last_refresh)) / 3600;
  
  RETURN v_hours_since_refresh >= 24;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_refresh_stats IS 
'Checks if stats can be refreshed (24 hour limit)';

-- ============================================================================
-- PART 9: COMMENTS
-- ============================================================================

COMMENT ON TABLE contests IS 'Fan edit contests created by admins';
COMMENT ON TABLE contest_prizes IS 'Prizes for each contest with payout amounts';
COMMENT ON TABLE contest_submissions IS 'User submissions to contests with verification and review status';
COMMENT ON TABLE social_accounts IS 'Connected social media accounts for verification';

COMMENT ON COLUMN contests.movie_identifier IS 'Identifier for the movie/project this contest is for';
COMMENT ON COLUMN contests.required_hashtags IS 'Array of required hashtags that must appear in submissions';
COMMENT ON COLUMN contests.required_description_template IS 'Optional pattern/template for description validation';
COMMENT ON COLUMN contest_submissions.processing_status IS 'Current stage of submission processing';
COMMENT ON COLUMN contest_submissions.impact_score IS 'Computed impact score using compute_impact() function';
COMMENT ON COLUMN contest_submissions.last_stats_refresh_at IS 'Timestamp of last manual stats refresh (enforces 24h limit)';

