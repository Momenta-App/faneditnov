-- Fix the quota function to handle NULL values correctly
-- Run this in Supabase SQL Editor

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

-- Test it
SELECT get_user_quota_status(
  (SELECT id FROM profiles WHERE email = 'contact@momenta.app'),
  'standard'
) as quota_status;

-- Expected: {"limit": 1, "current": 0, "remaining": 1, "allowed": true, ...}

