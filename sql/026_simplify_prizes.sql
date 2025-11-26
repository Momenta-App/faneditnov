-- ============================================================================
-- SIMPLIFY PRIZES TO PLACES
-- ============================================================================
-- This migration makes prize name and description optional since prizes
-- will be automatically named "First Place", "Second Place", etc. based on rank_order
-- ============================================================================

-- Make name and description nullable (they'll be auto-generated in the application)
ALTER TABLE contest_prizes
  ALTER COLUMN name DROP NOT NULL;

-- Description is already nullable, no change needed

-- Add a function to get place name from rank_order
CREATE OR REPLACE FUNCTION get_place_name(p_rank_order INTEGER)
RETURNS TEXT AS $$
BEGIN
  CASE p_rank_order
    WHEN 1 THEN RETURN 'First Place';
    WHEN 2 THEN RETURN 'Second Place';
    WHEN 3 THEN RETURN 'Third Place';
    WHEN 4 THEN RETURN 'Fourth Place';
    WHEN 5 THEN RETURN 'Fifth Place';
    WHEN 6 THEN RETURN 'Sixth Place';
    WHEN 7 THEN RETURN 'Seventh Place';
    WHEN 8 THEN RETURN 'Eighth Place';
    WHEN 9 THEN RETURN 'Ninth Place';
    WHEN 10 THEN RETURN 'Tenth Place';
    ELSE RETURN p_rank_order || 'th Place';
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_place_name IS 
'Returns the place name (e.g., "First Place", "Second Place") based on rank_order';

