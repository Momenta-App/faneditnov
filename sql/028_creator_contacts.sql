-- Migration: Creator Contacts Tracking
-- Date: 2024-11-03
-- Description: Track which creators users have contacted via the contact form

-- ============================================================================
-- CREATOR_CONTACTS TABLE
-- Tracks when users contact creators via the contact form
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators_hot(creator_id) ON DELETE CASCADE,
  contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only contact a creator once
  UNIQUE(user_id, creator_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_creator_contacts_user_id ON creator_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_creator_id ON creator_contacts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_contacted_at ON creator_contacts(contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_contacts_user_creator ON creator_contacts(user_id, creator_id);

-- RLS Policies
ALTER TABLE creator_contacts ENABLE ROW LEVEL SECURITY;

-- Users can read their own contacts
DROP POLICY IF EXISTS "Users can read own contacts" ON creator_contacts;
CREATE POLICY "Users can read own contacts" ON creator_contacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own contacts
DROP POLICY IF EXISTS "Users can insert own contacts" ON creator_contacts;
CREATE POLICY "Users can insert own contacts" ON creator_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No updates or deletes allowed (contacts are immutable)
-- Users can check if they've contacted a creator, but cannot modify/delete the record

COMMENT ON TABLE creator_contacts IS 'Tracks which creators users have contacted via the contact form';
COMMENT ON COLUMN creator_contacts.user_id IS 'The user who contacted the creator';
COMMENT ON COLUMN creator_contacts.creator_id IS 'The creator who was contacted';
COMMENT ON COLUMN creator_contacts.contacted_at IS 'When the contact form was submitted';

