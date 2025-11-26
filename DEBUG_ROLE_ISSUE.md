# Debugging Role Display Issue

## Current Status
- ✅ Database has correct role: `admin` for `admin@momenta.app`
- ✅ Direct database query returns: `role: "admin"`
- ❌ UI still displays: `standard`

## What We've Verified
1. Database query works correctly - returns `admin` role
2. Profile exists in `profiles` table with correct role
3. User ID matches: `f7374741-8fe2-4147-acf6-7773d6bd2805`

## Debugging Steps

### 1. Check Browser Console Logs
When you log in, you should see these logs in the browser console:

```
🔍 Session API - Profile fetch: { profileRole: 'admin', ... }
✅ Session API - Returning profile: { role: 'admin', ... }
📥 Raw API response: {"profile":{"role":"admin",...}}
Profile fetch result: { profileRole: 'admin', ... }
✅ Setting profile with role: admin
✅ Profile set successfully with role: admin
```

**What to look for:**
- Does `profileRole` show `'admin'` or `'standard'`?
- Does the raw API response contain `"role":"admin"`?
- Is the profile being set with the correct role?

### 2. Check Network Tab
1. Open DevTools → Network tab
2. Filter for `/api/auth/session`
3. Click on the request
4. Go to "Response" tab
5. Check if `profile.role` is `"admin"` or `"standard"`

### 3. Test Direct API Endpoint
Visit these URLs while logged in:

- `/api/auth/debug-profile` - Shows what the database returns
- `/api/auth/test-profile-direct` - Direct query without session checks

Both should show `role: "admin"`

### 4. Check for Multiple Profiles
Run this SQL query in Supabase:

```sql
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'admin@momenta.app' 
ORDER BY created_at DESC;
```

Check if there are multiple profiles with different roles.

### 5. Check for Caching
1. Open DevTools → Application tab
2. Clear all storage:
   - Local Storage
   - Session Storage
   - IndexedDB
   - Cache Storage
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Log out and log back in

### 6. Check Server Logs
Check your server/terminal logs for:
- `🔍 Session API - Profile fetch:` messages
- `✅ Session API - Returning profile:` messages
- Any error messages

## Possible Issues

### Issue 1: API Returning Wrong Data
**Symptom:** Network tab shows `role: "standard"` in API response
**Fix:** Check server logs to see what the database query returns

### Issue 2: Client Caching
**Symptom:** API returns correct data but UI shows old value
**Fix:** Clear all browser storage and hard refresh

### Issue 3: Multiple Profiles
**Symptom:** Database has multiple profiles, wrong one is being returned
**Fix:** Check SQL query above, delete duplicate profiles

### Issue 4: Wrong User ID
**Symptom:** Querying wrong user's profile
**Fix:** Check that `session.user.id` matches the admin user ID

## Next Steps

1. **Check browser console** - Look for the log messages above
2. **Check network tab** - Verify the API response
3. **Test debug endpoints** - Visit `/api/auth/debug-profile`
4. **Share the logs** - Copy the console logs and network response

The enhanced logging should show exactly where the role is being lost or changed.

