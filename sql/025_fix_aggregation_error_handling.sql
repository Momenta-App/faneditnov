-- ============================================================================
-- FIX: Make aggregation errors more visible
-- Changes the exception handler to log errors instead of silently ignoring
-- ============================================================================

-- This is just a note - we should change the ingestion function to:
-- 1. Log aggregation errors more prominently
-- 2. Return aggregation status in the result

-- For now, let's create a helper function to verify aggregations work

CREATE OR REPLACE FUNCTION test_aggregations() RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Try to run aggregations
  SELECT update_aggregations() INTO v_result;
  
  RAISE NOTICE 'Aggregation test result: %', v_result;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aggregations function is working',
    'result', v_result
  );
EXCEPTION
  WHEN undefined_function THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'update_aggregations function does not exist',
      'hint', 'Run sql/012_aggregation.sql to create it'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- Test it immediately
SELECT test_aggregations();

