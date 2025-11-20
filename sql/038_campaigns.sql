-- Migration: Campaigns Feature
-- This migration adds the campaigns table for user-generated campaign searches

-- ============================================================================
-- CAMPAIGNS TABLE
-- Main table for user campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- Auto-generated from input_text (e.g., "Canada Campaign")
  input_text TEXT NOT NULL,  -- Original user search string
  ai_payload JSONB NOT NULL,  -- Full AI suggestion used
  hashtags JSONB NOT NULL,  -- Array of all hashtags extracted from AI payload
  video_ids JSONB NOT NULL DEFAULT '[]',  -- Array of video IDs found matching hashtags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
CREATE POLICY "Users can view own campaigns" ON campaigns 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own campaigns" ON campaigns;
CREATE POLICY "Users can create own campaigns" ON campaigns 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE campaigns IS 'User-generated campaigns from AI suggestions based on region/market searches';
COMMENT ON COLUMN campaigns.name IS 'Auto-generated name from input_text (e.g., "Canada Campaign")';
COMMENT ON COLUMN campaigns.input_text IS 'Original user search string (e.g., "Canada", "India")';
COMMENT ON COLUMN campaigns.ai_payload IS 'Full AI suggestion JSON containing sport, league, teams, hashtags';
COMMENT ON COLUMN campaigns.hashtags IS 'Array of normalized hashtags extracted from AI payload';
COMMENT ON COLUMN campaigns.video_ids IS 'Array of video IDs that match any of the campaign hashtags';

