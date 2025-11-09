-- Migration: Profiles and Authentication
-- This migration adds:
-- 1. profiles table (links auth.users to app user profiles)
-- 2. Role enum and role-based permissions
-- 3. Profile creation trigger on user signup
-- 4. Updated RLS policies for profiles and communities
-- 5. User daily quotas table for rate limiting
-- 6. Helper functions for role checks

-- ============================================================================
-- PROFILES TABLE
-- Links Supabase auth.users to application user profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'standard' CHECK (role IN ('standard', 'creator', 'brand', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================================================
-- RLS POLICIES FOR PROFILES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    -- Prevent role escalation
  )
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    -- Cannot change role via RLS
  );

-- Public read NOT allowed (privacy - users can only see their own)
-- Role updates must be done via admin API using service role

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users with role-based access control';
COMMENT ON COLUMN profiles.role IS 'User role: standard, creator, brand, or admin';

-- ============================================================================
-- FUNCTION: Handle New User (Profile Creation Trigger)
-- Automatically creates a profile when a user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    'standard',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- FUNCTION: Get User Role
-- Helper function to get user role from auth context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE COMMUNITIES TABLE
-- Change created_by to reference profiles.id
-- ============================================================================

-- First, allow NULL for created_by during migration
ALTER TABLE communities 
  ALTER COLUMN created_by DROP NOT NULL;

-- If created_by is TEXT, we need to handle migration
-- Check if we need to convert existing TEXT values
-- For now, set existing values to NULL (safe default)
UPDATE communities 
SET created_by = NULL 
WHERE created_by IS NOT NULL AND created_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Change column type to UUID (will fail if any non-UUID values remain)
-- If there are issues, we can add a new column instead
DO $$
BEGIN
  -- Attempt to change type
  BEGIN
    ALTER TABLE communities 
      ALTER COLUMN created_by TYPE UUID 
      USING created_by::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, add new column and migrate
    ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    
    -- Copy valid UUID values
    UPDATE communities 
    SET owner_id = created_by::UUID 
    WHERE created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    -- Drop old column
    ALTER TABLE communities DROP COLUMN created_by;
    
    -- Rename new column
    ALTER TABLE communities RENAME COLUMN owner_id TO created_by;
  END;
END $$;

-- Add foreign key constraint
ALTER TABLE communities 
  DROP CONSTRAINT IF EXISTS fk_communities_created_by;
  
ALTER TABLE communities 
  ADD CONSTRAINT fk_communities_created_by 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON communities(created_by);

-- ============================================================================
-- UPDATE RLS POLICIES FOR COMMUNITIES
-- Replace overly permissive policies with role-based ones
-- ============================================================================

-- Drop old permissive policy
DROP POLICY IF EXISTS "Authenticated write access" ON communities;

-- Public read (keep existing)
-- Policy already exists from 017_communities.sql, no need to recreate

-- Brand or Admin can create communities (but must set created_by)
CREATE POLICY "Brand or admin can create communities" ON communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('brand', 'admin')
    )
    AND created_by = auth.uid() -- Must set self as owner
  );

-- Owner (brand) or admin can update
CREATE POLICY "Owner or admin can update communities" ON communities
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Only admin can delete
CREATE POLICY "Only admin can delete communities" ON communities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- UPDATE RLS POLICIES FOR COMMUNITY MEMBERSHIP TABLES
-- Restrict write access (only service role should write via functions)
-- ============================================================================

-- Remove overly permissive write policies
DROP POLICY IF EXISTS "Authenticated write access" ON community_video_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_creator_memberships;
DROP POLICY IF EXISTS "Authenticated write access" ON community_hashtag_memberships;

-- Keep public read (needed for UI)
-- Policies already exist from 017_communities.sql

-- Note: Membership tables are managed by database functions (backfill, sync)
-- which use service role and bypass RLS. No direct user writes needed.

-- ============================================================================
-- USER DAILY QUOTAS TABLE
-- Tracks per-user daily usage for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_daily_quotas (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  video_submissions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_daily_quotas_date ON user_daily_quotas(date);
CREATE INDEX IF NOT EXISTS idx_user_daily_quotas_user_id ON user_daily_quotas(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_daily_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_daily_quotas_updated_at ON user_daily_quotas;
CREATE TRIGGER trigger_user_daily_quotas_updated_at
  BEFORE UPDATE ON user_daily_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_user_daily_quotas_updated_at();

-- RLS for quotas (users can read their own)
ALTER TABLE user_daily_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quotas" ON user_daily_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert/update handled by service role in API routes

COMMENT ON TABLE user_daily_quotas IS 'Daily usage quotas per user for rate limiting';
COMMENT ON COLUMN user_daily_quotas.video_submissions IS 'Number of video URL submissions today';

-- ============================================================================
-- FUNCTION: Increment Video Submission Quota
-- Atomically increments quota counter
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_video_submission_quota(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_current INTEGER;
BEGIN
  INSERT INTO user_daily_quotas (user_id, date, video_submissions)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    video_submissions = user_daily_quotas.video_submissions + 1,
    updated_at = NOW();
  
  SELECT video_submissions INTO v_current
  FROM user_daily_quotas
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  RETURN COALESCE(v_current, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get User Quota Status
-- Returns current quota usage for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_quota_status(p_user_id UUID, p_role TEXT)
RETURNS JSONB AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
  v_date DATE := CURRENT_DATE;
  v_allowed BOOLEAN;
BEGIN
  -- Set limit based on role
  CASE p_role
    WHEN 'admin' THEN v_limit := 999999; -- Effectively unlimited
    WHEN 'creator' THEN v_limit := 10;
    WHEN 'brand' THEN v_limit := 5;
    ELSE v_limit := 1; -- standard
  END CASE;
  
  -- Get current count (defaults to 0 if no row exists)
  SELECT COALESCE(video_submissions, 0) INTO v_current
  FROM user_daily_quotas
  WHERE user_id = p_user_id AND date = v_date;
  
  -- Ensure v_current is never NULL (in case SELECT found no rows)
  v_current := COALESCE(v_current, 0);
  
  -- Calculate allowed (ensure it's a proper boolean, not NULL)
  v_allowed := (v_current < v_limit);
  
  RETURN jsonb_build_object(
    'limit', v_limit,
    'current', v_current,
    'remaining', GREATEST(0, v_limit - v_current),
    'allowed', v_allowed,
    'date', v_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_quota_status IS 'Get quota status for a user based on their role';

