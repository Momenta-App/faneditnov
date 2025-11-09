-- Find the name of the CHECK constraint on profiles.role
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%role%';

