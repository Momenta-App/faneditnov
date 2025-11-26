-- ============================================================================
-- CREATE CONTEST ASSET LINKS TABLE
-- ============================================================================
-- Creates a table to store asset links for contests (e.g., download links
-- for logos, fonts, images, etc. that users can use in their submissions)

CREATE TABLE IF NOT EXISTS contest_asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contest_asset_links_contest_id ON contest_asset_links(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_asset_links_display_order ON contest_asset_links(contest_id, display_order);

-- Enable RLS
ALTER TABLE contest_asset_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can read asset links
DROP POLICY IF EXISTS "Public can read contest asset links" ON contest_asset_links;
CREATE POLICY "Public can read contest asset links" ON contest_asset_links
  FOR SELECT
  USING (true);

-- Only admins can manage asset links
DROP POLICY IF EXISTS "Admins can manage contest asset links" ON contest_asset_links;
CREATE POLICY "Admins can manage contest asset links" ON contest_asset_links
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_contest_asset_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contest_asset_links_updated_at ON contest_asset_links;
CREATE TRIGGER trigger_contest_asset_links_updated_at
  BEFORE UPDATE ON contest_asset_links
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_asset_links_updated_at();

