-- ============================================================================
-- BD_INGESTIONS TABLE
-- Tracks ingestion jobs and their status for monitoring and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS bd_ingestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id TEXT UNIQUE NOT NULL,
  dataset_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  raw_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bd_ingestions_snapshot_id ON bd_ingestions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_bd_ingestions_status ON bd_ingestions(status);
CREATE INDEX IF NOT EXISTS idx_bd_ingestions_created_at ON bd_ingestions(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_bd_ingestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bd_ingestions_updated_at ON bd_ingestions;
CREATE TRIGGER trigger_bd_ingestions_updated_at
  BEFORE UPDATE ON bd_ingestions
  FOR EACH ROW
  EXECUTE FUNCTION update_bd_ingestions_updated_at();

COMMENT ON TABLE bd_ingestions IS 'Tracks Bright Data ingestion jobs and their processing status';
COMMENT ON COLUMN bd_ingestions.snapshot_id IS 'Bright Data snapshot ID (unique identifier)';
COMMENT ON COLUMN bd_ingestions.status IS 'Ingestion status: pending, processing, completed, or failed';
COMMENT ON COLUMN bd_ingestions.raw_count IS 'Number of raw records in the snapshot';
COMMENT ON COLUMN bd_ingestions.processed_count IS 'Number of records successfully processed';

