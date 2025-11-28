-- ============================================================================
-- MIGRATION: Create Contest Status Calculation Function
-- ============================================================================
-- This migration creates a function to automatically calculate contest status
-- based on start_date and end_date. Used for automatic status updates.
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_contest_status(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
) RETURNS TEXT AS $$
DECLARE
  now_time TIMESTAMPTZ := NOW();
BEGIN
  -- If current time is before start date, contest is upcoming
  IF now_time < start_date THEN
    RETURN 'upcoming';
  END IF;
  
  -- If current time is between start and end date, contest is live
  IF now_time >= start_date AND now_time <= end_date THEN
    RETURN 'live';
  END IF;
  
  -- If current time is after end date, contest has ended
  IF now_time > end_date THEN
    RETURN 'ended';
  END IF;
  
  -- Fallback (shouldn't happen)
  RETURN 'upcoming';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to update contest status based on dates
-- This can be called to refresh status for contests that aren't drafts
CREATE OR REPLACE FUNCTION update_contest_status_from_dates()
RETURNS void AS $$
BEGIN
  UPDATE contests
  SET status = calculate_contest_status(start_date, end_date)
  WHERE status != 'draft'
    AND status != calculate_contest_status(start_date, end_date);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_contest_status IS 'Calculates contest status (upcoming/live/ended) based on start_date and end_date';
COMMENT ON FUNCTION update_contest_status_from_dates IS 'Updates status for all non-draft contests based on their dates';

