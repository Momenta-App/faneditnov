-- Migration: Add linked_hashtags to campaigns table to match communities structure
-- This allows campaigns to use the same membership/backfill logic as communities

-- First, ensure campaigns table exists (create if it doesn't - from migration 038)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input_text TEXT NOT NULL,
  ai_payload JSONB NOT NULL,
  hashtags JSONB NOT NULL,
  video_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
CREATE POLICY "Users can view own campaigns" ON campaigns 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own campaigns" ON campaigns;
CREATE POLICY "Users can create own campaigns" ON campaigns 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add linked_hashtags column (TEXT[]) to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS linked_hashtags TEXT[] DEFAULT '{}';

-- Create index for linked_hashtags (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_campaigns_linked_hashtags ON campaigns USING GIN(linked_hashtags);

-- Migrate existing hashtags JSONB to linked_hashtags TEXT[]
-- Convert JSONB array to TEXT[] array
UPDATE campaigns
SET linked_hashtags = ARRAY(
  SELECT jsonb_array_elements_text(hashtags)
)
WHERE linked_hashtags = '{}' AND hashtags IS NOT NULL AND jsonb_typeof(hashtags) = 'array';

-- Normalize existing linked_hashtags (lowercase, remove #)
UPDATE campaigns
SET linked_hashtags = ARRAY(
  SELECT LOWER(REPLACE(tag, '#', ''))
  FROM UNNEST(linked_hashtags) AS tag
)
WHERE array_length(linked_hashtags, 1) > 0;

COMMENT ON COLUMN campaigns.linked_hashtags IS 'Array of normalized hashtags for membership matching (same as communities.linked_hashtags)';

