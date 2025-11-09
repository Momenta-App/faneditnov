# Troubleshooting Authentication Issues

## Current Issue: Profile Created But Header Not Showing User

**Symptoms:**
- ✅ Profile exists in database
- ❌ Header doesn't show user info
- ❌ "Invalid credentials" on login

## Solution Steps

### Step 1: Clear Session and Sign In Fresh

The session might be stale. Do this:

1. **Open browser DevTools** (F12)
2. **Go to Application tab** → **Cookies**
3. **Delete all cookies** for your domain (or use "Clear site data")
4. **Close and reopen the browser** (or hard refresh: Cmd/Ctrl + Shift + R)

### Step 2: Sign In Again

After clearing cookies:
1. Go to `/auth/login`
2. Enter your credentials:
   - Email: `everett@momenta.app`
   - Password: (the one you used during signup)
3. Click "Sign in"

### Step 3: Check Browser Console

Open DevTools → Console tab. You should see:
- `Auth state changed: SIGNED_IN` 
- `Profile fetch result: { hasProfile: true, ... }`

### Step 4: Verify Profile is Loaded

After login, check Network tab:
1. Look for `/api/auth/session` request
2. Check the response - should have `profile` object

## Alternative: Force Refresh Profile

If still not working, add this temporary debug code:

1. Open browser console
2. Run:
```javascript
// Force refresh auth session
window.location.reload();
```

Or manually trigger:
```javascript
// Check if auth context is working
const checkAuth = async () => {
  const response = await fetch('/api/auth/session');
  const data = await response.json();
  console.log('Session data:', data);
  return data;
};
checkAuth();
```

## Check If Password is Correct

If "invalid credentials" persists:

1. **Try password reset** (if available)
2. **Or create a new account** with a different email to test
3. **Or check Supabase Dashboard** → Authentication → Users → Your email → Reset password

## Database Verification

Run this in Supabase SQL Editor to verify everything:

```sql
-- Check user and profile match
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.id as profile_id,
  p.role,
  p.email_verified,
  CASE 
    WHEN p.id IS NOT NULL THEN '✅ Profile exists'
    ELSE '❌ Profile missing'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'everett@momenta.app';
```

Expected: Should show profile exists.

## Common Causes

1. **Session cookie expired** - Clear cookies and sign in again
2. **Password mismatch** - Verify password is correct
3. **Browser cache** - Hard refresh or clear cache
4. **CORS/Cookie issues** - Check Supabase settings
5. **Session not persisting** - Check Supabase auth settings

## Still Not Working?

1. Check Supabase Dashboard → Authentication → Settings
   - Email confirmation: Should be "OFF" or "Optional"
   - Site URL: Should match your app URL

2. Check browser console for errors

3. Check Network tab for failed requests

4. Verify environment variables are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

