# Email Verification Setup Guide

## Overview

This guide explains how to configure Supabase email verification so that users are automatically logged in when they click the verification link in their email.

## Production URL

**Production Site:** `https://www.fanedit.com/`

## Supabase Dashboard Configuration

### 1. Site URL Configuration

In Supabase Dashboard → **Authentication** → **URL Configuration**:

1. **Site URL:**
   - Development: `http://localhost:3000`
   - Production: `https://www.fanedit.com`

### 2. Redirect URLs

Add these redirect URLs to the **Allowed Redirect URLs** list:

**Development:**
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

**Production:**
```
https://www.fanedit.com/auth/callback
https://www.fanedit.com/auth/reset-password
```

**Important:** URLs must match exactly, including:
- `http://` vs `https://` protocol
- `www.` subdomain (if used)
- Trailing slashes (or lack thereof)

### 3. Email Templates

In Supabase Dashboard → **Authentication** → **Email Templates**:

1. **Confirm signup** template should include:
   ```
   Click the link below to confirm your email:
   {{ .ConfirmationURL }}
   ```

2. **Magic Link** template (if used):
   ```
   Click the link below to sign in:
   {{ .ConfirmationURL }}
   ```

## Environment Variables

### Production (Vercel)

Make sure `NEXT_PUBLIC_APP_URL` is set to:
```bash
NEXT_PUBLIC_APP_URL=https://www.fanedit.com
```

### Development (`.env.local`)

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## How It Works

1. **User logs in** → Supabase sends email verification link
2. **User clicks link** → Redirected to `/auth/callback` with verification token
3. **Callback processes token** → Session is automatically established
4. **User is logged in** → Redirected to home page

## Testing

### Development
1. Log in at `http://localhost:3000/auth/login`
2. Check email for verification link
3. Click the link
4. Should be automatically logged in and redirected to home page

### Production
1. Log in at `https://www.fanedit.com/auth/login`
2. Check email for verification link
3. Click the link
4. Should be automatically logged in and redirected to home page

## Troubleshooting

### Issue: "Redirect URL not allowed"

**Solution:** Make sure the exact URL is in the Allowed Redirect URLs list in Supabase Dashboard. Check:
- Protocol (`http://` vs `https://`)
- Subdomain (`www.` vs no `www.`)
- Trailing slash

### Issue: "No token in auth callback"

**Solution:** Check that email verification is enabled in Supabase Dashboard → Authentication → Settings.

### Issue: Session not persisting

**Solution:** Make sure `detectSessionInUrl: true` is set in `src/lib/supabase-client.ts` (already configured).

## Files Involved

- `src/app/api/auth/callback/route.ts` - Server-side callback handler
- `src/app/auth/callback/page.tsx` - Client-side callback page
- `src/app/api/auth/signup/route.ts` - Signup route (includes `emailRedirectTo`)
- `src/lib/supabase-client.ts` - Supabase client configuration

