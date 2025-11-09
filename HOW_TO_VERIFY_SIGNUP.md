# How to Verify User Signup Worked ✅

After going through the signup flow, here are multiple ways to verify everything worked correctly.

## Quick Verification Methods

### 1. Visual Check (Easiest)
After signing up, you should:
- ✅ Be automatically redirected to home page (`/`)
- ✅ See your email or display name in the header (top right)
- ✅ See "Sign Out" button instead of "Login/Sign Up"
- ✅ User avatar/profile picture shows in header

**If you see this, signup worked!** ✅

### 2. Try Logging Out and Back In
1. Click "Sign Out" in header
2. You should be logged out
3. Click "Login" in header
4. Enter your email and password
5. Should successfully log in

**If login works, signup definitely worked!** ✅

### 3. Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. After signup, look for:
   - No red error messages
   - Auth state change logs (optional)
   - Session created messages

### 4. Check Database (Most Thorough)

#### Option A: Via SQL Script
Run the verification script (update your email first):

```bash
# Edit scripts/verify-user-signup.sql and replace 'YOUR_EMAIL_HERE' with your email
pnpm sql scripts/verify-user-signup.sql
```

Expected results:
- ✅ User exists in `auth.users` table
- ✅ Profile exists in `profiles` table  
- ✅ Profile has `role = 'standard'` (default)
- ✅ Profile `id` matches `auth.users.id`

#### Option B: Via Supabase Dashboard
1. Go to Supabase Dashboard → Authentication → Users
2. Find your email
3. Verify:
   - User was created
   - Email matches
   - Created timestamp is recent

4. Go to Database → Table Editor → `profiles`
5. Find your email
6. Verify:
   - Profile exists
   - `role` = `standard`
   - `email_verified` = `false` (unless you verified email)
   - `created_at` matches signup time

## Common Issues and Solutions

### Issue: "Profile not found" error
**Symptom:** Signup succeeds but profile doesn't show in header

**Check:**
```sql
-- See if trigger created profile
SELECT * FROM profiles WHERE email = 'your-email@example.com';
```

**Fix if missing:**
- The trigger should auto-create profiles
- If missing, the `/api/auth/session` route has a fallback
- Or manually create:
  ```sql
  INSERT INTO profiles (id, email, role)
  SELECT id, email, 'standard'
  FROM auth.users
  WHERE email = 'your-email@example.com'
  AND id NOT IN (SELECT id FROM profiles);
  ```

### Issue: Can't see profile in header
**Possible causes:**
1. AuthContext not loading session - check browser console
2. Profile exists but header not updating - refresh page
3. Session cookie issue - clear cookies and try again

**Debug:**
- Open browser DevTools → Application → Cookies
- Look for Supabase session cookie
- Check Network tab for `/api/auth/session` request

### Issue: Default role is wrong
**Check:**
```sql
SELECT email, role FROM profiles WHERE email = 'your-email@example.com';
```

**Expected:** `role` should be `'standard'`

**If wrong:**
```sql
UPDATE profiles 
SET role = 'standard' 
WHERE email = 'your-email@example.com';
```

## Test Full Flow

After verifying signup worked, test the complete authentication flow:

1. **Sign Up** ✅ (you did this)
2. **Check Header** - See your email/name
3. **Sign Out** - Click sign out button
4. **Sign In** - Use your credentials to log back in
5. **Page Refresh** - Session should persist
6. **Protected Action** - Try submitting a video URL (should work)

## Test Role-Based Features

As a `standard` user, verify:
- ✅ Can view all pages
- ✅ Can submit 1 video URL per day (`/scraper` page)
- ❌ Cannot see "Create Community" button (`/communities` page)
- ❌ Cannot edit communities you don't own

## Next: Promote to Admin (Optional)

If you want to test admin features, promote your account:

```sql
UPDATE profiles 
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

Then refresh the page and you should:
- ✅ See "Create Community" button
- ✅ Be able to edit any community
- ✅ Have unlimited video submissions

---

**Need help?** Check browser console for errors or run the verification SQL script for detailed database status.

