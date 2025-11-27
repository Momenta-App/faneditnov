-- Migration: Create function to update contest submission review status
-- This function uses SECURITY DEFINER to bypass RLS and ensure updates persist

CREATE OR REPLACE FUNCTION public.update_contest_submission_review_status(
  p_submission_id INTEGER,
  p_hashtag_status TEXT DEFAULT NULL,
  p_description_status TEXT DEFAULT NULL,
  p_content_review_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  content_review_status TEXT,
  hashtag_status TEXT,
  description_status TEXT,
  processing_status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_update RECORD;
  v_updates JSONB := '{}'::JSONB;
  v_processing_status TEXT;
  v_updated RECORD;
BEGIN
  -- Get current state
  SELECT 
    cs.id,
    cs.content_review_status,
    cs.hashtag_status,
    cs.description_status,
    cs.processing_status
  INTO v_before_update
  FROM public.contest_submissions cs
  WHERE cs.id = p_submission_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found: %', p_submission_id;
  END IF;
  
  -- Build updates object
  IF p_hashtag_status IS NOT NULL THEN
    v_updates := v_updates || jsonb_build_object('hashtag_status', p_hashtag_status);
  END IF;
  
  IF p_description_status IS NOT NULL THEN
    v_updates := v_updates || jsonb_build_object('description_status', p_description_status);
  END IF;
  
  IF p_content_review_status IS NOT NULL THEN
    v_updates := v_updates || jsonb_build_object('content_review_status', p_content_review_status);
    
    -- Handle processing_status updates based on content_review_status
    IF v_before_update.content_review_status = 'approved' AND 
       (p_content_review_status = 'pending' OR p_content_review_status = 'rejected') THEN
      -- Changing from approved to pending/rejected
      v_processing_status := 'waiting_review';
      v_updates := v_updates || jsonb_build_object('processing_status', v_processing_status);
    ELSIF p_content_review_status = 'approved' THEN
      -- Changing to approved - check if both checks pass
      IF (v_before_update.hashtag_status = 'pass' OR v_before_update.hashtag_status = 'approved_manual') AND
         (v_before_update.description_status = 'pass' OR v_before_update.description_status = 'approved_manual') THEN
        v_processing_status := 'approved';
        v_updates := v_updates || jsonb_build_object('processing_status', v_processing_status);
      END IF;
    END IF;
  END IF;
  
  -- Perform the update
  UPDATE public.contest_submissions
  SET
    hashtag_status = CASE 
      WHEN v_updates->>'hashtag_status' IS NOT NULL 
      THEN (v_updates->>'hashtag_status')::TEXT 
      ELSE hashtag_status 
    END,
    description_status = CASE 
      WHEN v_updates->>'description_status' IS NOT NULL 
      THEN (v_updates->>'description_status')::TEXT 
      ELSE description_status 
    END,
    content_review_status = CASE 
      WHEN v_updates->>'content_review_status' IS NOT NULL 
      THEN (v_updates->>'content_review_status')::TEXT 
      ELSE content_review_status 
    END,
    processing_status = CASE 
      WHEN v_updates->>'processing_status' IS NOT NULL 
      THEN (v_updates->>'processing_status')::TEXT 
      ELSE processing_status 
    END,
    updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Return the updated row
  RETURN QUERY
  SELECT 
    cs.id,
    cs.content_review_status,
    cs.hashtag_status,
    cs.description_status,
    cs.processing_status,
    cs.updated_at
  FROM public.contest_submissions cs
  WHERE cs.id = p_submission_id;
END;
$$;

-- Grant execute permission to service_role and authenticated users
GRANT EXECUTE ON FUNCTION public.update_contest_submission_review_status(INTEGER, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_contest_submission_review_status(INTEGER, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_contest_submission_review_status IS 'Updates contest submission review statuses with SECURITY DEFINER to bypass RLS';

