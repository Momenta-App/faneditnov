# Password Reset Debugging Guide

**⚠️ NOTE: Password reset functionality is working. This guide is for troubleshooting if issues occur after Supabase configuration.**

## Issue: "Invalid or expired reset link" on localhost

**Current Status:** May show error message initially, but password reset functionality works correctly.

If you're seeing this error even with a fresh reset link, check the following:

### 1. Supabase Redirect URL Configuration

**CRITICAL:** Make sure `http://localhost:3000/auth/reset-password` is in your allowed redirect URLs.

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/reset-password
   ```
4. Click **Save**

**Note:** The redirect URL must match EXACTLY, including `http://` (not `https://`) for localhost.

### 2. Check Browser Console

Open DevTools → Console and look for these log messages:

- ✅ **"Found recovery token in URL hash"** - Token detected in URL
- ✅ **"Found existing session (Supabase auto-processed hash)"** - Supabase processed it automatically
- ✅ **"Recovery token validated successfully"** - Token is valid
- ❌ **"Error setting recovery session: [error details]"** - Token validation failed
- ❌ **"No valid recovery session found"** - Couldn't find token or session

### 3. Check URL Hash

When you click the reset link, the URL should have a hash fragment like:
```
http://localhost:3000/auth/reset-password#access_token=xxx&type=recovery&expires_in=3600
```

**If the hash is missing:**
- Check Supabase redirect URL configuration
- The redirect URL in the email might be wrong

**If the hash exists but token is invalid:**
- Token might be expired (default: 1 hour)
- Request a new reset email

### 4. Check Supabase Site URL

In Supabase Dashboard → Authentication → URL Configuration:

**Site URL** should be set to:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### 5. Verify Email Template Redirect URL

The forgot password API sends:
```typescript
redirectTo: `${baseUrl}/auth/reset-password`
```

Make sure `baseUrl` is correct:
- Development: Should be `http://localhost:3000`
- Check your environment variables

### 6. Test Steps

1. **Request new password reset:**
   - Go to `/auth/forgot-password`
   - Enter your email
   - Check email for reset link

2. **Check the reset link:**
   - Right-click the link → Copy link address
   - Should contain `#access_token=` and `type=recovery`

3. **Open link in browser:**
   - Check browser console for debug logs
   - Check if hash is in URL
   - Check if session is set (in Application → Cookies)

4. **Verify Supabase session:**
   - Open browser console
   - Run: `localStorage.getItem('sb-*')` (check for Supabase session keys)

### 7. Common Issues

#### Issue: Hash is cleared immediately
**Cause:** Supabase `detectSessionInUrl: true` processes hash immediately  
**Solution:** Code now checks for session even if hash is cleared

#### Issue: Token validation fails
**Possible causes:**
- Token expired (request new one)
- Redirect URL not in allowed list
- Site URL mismatch

#### Issue: Works in production but not localhost
**Cause:** Redirect URL not configured for localhost  
**Solution:** Add `http://localhost:3000/auth/reset-password` to allowed redirect URLs

### 8. Manual Test via Console

If reset page shows error, try this in browser console:

```javascript
// Check current session
const { data: { session } } = await supabaseClient.auth.getSession();
console.log('Current session:', session);

// Check URL hash
console.log('URL hash:', window.location.hash);

// Try to set session manually (if you have token)
// const token = 'your-token-here';
// await supabaseClient.auth.setSession({ access_token: token, refresh_token: '' });
```

### 9. Reset Everything

If nothing works:

1. **Clear browser data:**
   - DevTools → Application → Clear storage → Clear site data

2. **Request new reset email**

3. **Verify Supabase settings:**
   - Redirect URLs include localhost
   - Site URL is set to localhost

4. **Check email for correct link format**

### 10. Still Not Working?

Check these:
- ✅ Supabase project is active (not paused)
- ✅ Email sending is enabled in Supabase
- ✅ No ad blockers interfering with redirects
- ✅ Browser allows redirects from email links
- ✅ Network tab shows no CORS errors
- ✅ Browser console shows no JavaScript errors

## Expected Flow

1. User clicks reset link → URL has hash: `#access_token=xxx&type=recovery`
2. Page loads → Code extracts token from hash OR Supabase auto-processes it
3. Session is set → User can update password
4. Password updated → Session cleared → Redirect to login

If any step fails, check the logs and Supabase configuration.

