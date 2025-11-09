# Debugging Signup & Login Issues

## Current Issues:
1. ❌ "Invalid credentials" on login
2. ❌ "Database error saving new user" on signup

## Immediate Steps to Debug

### Step 1: Check Browser Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. Try to sign up again
4. Look for **red error messages**
5. Copy any errors you see

### Step 2: Check Network Tab
1. Open DevTools → **Network** tab
2. Try signing up
3. Look for the `/api/auth/signup` request
4. Click on it → **Response** tab
5. This will show the actual error message

### Step 3: Check Server Logs
Look at your terminal/console where you're running `pnpm dev`:
- You should see detailed error messages
- Look for "Error creating profile" or "Signup error"

### Step 4: Verify Trigger Exists
Run this in Supabase SQL Editor:

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_name = 'on_auth_user_created';
```

**Expected:** Should show 1 row with the trigger

**If empty:** Run `scripts/fix-profile-trigger.sql`

## Common Causes & Fixes

### Issue: Trigger Not Working
**Fix:** Run this in Supabase SQL Editor:
```sql
-- Copy from: scripts/fix-profile-trigger.sql
```

### Issue: Password Wrong
**Fix:** Try password reset OR create new account with different email to test

### Issue: RLS Blocking
**Unlikely** (we use service role), but check:
```sql
-- Should show rls_enabled = true
SELECT rowsecurity FROM pg_tables 
WHERE tablename = 'profiles';
```

### Issue: Email Already Exists
If the email is already in auth.users, you can't sign up again. Options:
1. Use a different email
2. Or try logging in instead

## Quick Test

Try creating an account with:
- **Different email** (e.g., `test2@example.com`)
- **Simple password** (6+ characters)

See if that works - will tell us if it's email-specific or general issue.

## What to Share

When reporting back, please share:
1. **Browser console errors** (if any)
2. **Network tab response** from `/api/auth/signup` request
3. **Server/terminal logs** showing the error
4. **Trigger check result** (does trigger exist?)

This will help pinpoint the exact issue.

