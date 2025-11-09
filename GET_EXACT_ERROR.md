# How to Get Exact Error Messages

## Step 1: Check Network Tab Response

1. Open **DevTools** (F12)
2. Go to **Network** tab
3. **Clear** the network log (trash icon)
4. Try signing up again
5. Find the `/api/auth/signup` request in the list
6. Click on it
7. Go to **Response** tab (or **Preview** tab)

**This will show the actual error message!** 

It should look like:
```json
{
  "error": "Database error saving profile: ...",
  "code": "PROFILE_CREATION_ERROR"
}
```

**Copy that exact error message.**

## Step 2: Check Terminal/Server Logs

Look at the terminal where you're running `pnpm dev`:
- After trying to sign up, you should see console.log statements
- Look for lines like:
  - `Profile not found by trigger...`
  - `Error creating profile:`
  - `Signup error:`

**Copy those error messages too.**

## Step 3: Check Trigger Status

Run this in **Supabase SQL Editor**:

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_name = 'on_auth_user_created';
```

**Expected:** Should show 1 row

**If empty:** The trigger doesn't exist - run `scripts/fix-profile-trigger.sql`

---

**Once you have the exact error message from Network tab, share it and we can fix it!**

