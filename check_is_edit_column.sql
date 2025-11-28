-- Quick check to see if is_edit column exists
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'videos_hot' 
  AND column_name = 'is_edit';

