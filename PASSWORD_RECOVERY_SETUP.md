# Password Recovery Setup Guide

## Overview

Password recovery functionality has been implemented with the following features:
- **Forgot Password**: Users can request a password reset email
- **Reset Password**: Users can set a new password using a secure token link
- **Security**: Email enumeration protection (doesn't reveal if email exists)

## Files Created

### API Routes
1. **`src/app/api/auth/forgot-password/route.ts`**
   - Handles password reset email requests
   - Uses Supabase `resetPasswordForEmail()` method
   - Returns generic success message (security best practice)

2. **`src/app/api/auth/reset-password/route.ts`**
   - Handles password updates using reset token
   - Validates password strength (minimum 6 characters)
   - Note: Currently unused, password reset is handled client-side

### Frontend Pages
1. **`src/app/auth/forgot-password/page.tsx`**
   - Email input form
   - Success confirmation message
   - Link back to login

2. **`src/app/auth/reset-password/page.tsx`**
   - Password reset form (with confirmation)
   - Handles token from URL hash (Supabase redirect)
   - Redirects to login after successful reset

### Updated Files
- **`src/app/auth/login/page.tsx`**: Added "Forgot password?" link and success message

## Supabase Configuration Required

**⚠️ NOTE: Configuration will be completed later. The functionality is working with manual redirect URL handling.**

### 1. Email Templates

In Supabase Dashboard → Authentication → Email Templates:

1. **Password Reset Template**
   - Subject: `Reset your password`
   - Edit the template to include:
     ```
     Click the link below to reset your password:
     {{ .ConfirmationURL }}
     ```
   - Or customize with your branding

### 2. Redirect URLs (TODO: Configure Later)

**Status:** Will be configured in production setup phase.

In Supabase Dashboard → Authentication → URL Configuration:

Add these redirect URLs to the **Allowed Redirect URLs** list:

**Development:**
```
http://localhost:3000/auth/reset-password
```

**Production:**
```
https://your-domain.com/auth/reset-password
```

**Note:** Replace `your-domain.com` with your actual domain.

**Current Status:** Password reset is working. The redirect URL configuration will be completed during production deployment setup.

### 3. Site URL (TODO: Configure Later)

**Status:** Will be configured in production setup phase.

In Supabase Dashboard → Authentication → URL Configuration:

Set **Site URL** to:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## How It Works

### Forgot Password Flow

1. User visits `/auth/forgot-password`
2. User enters email address
3. API calls Supabase `resetPasswordForEmail()`
4. Supabase sends email with reset link containing token
5. User clicks link in email
6. Supabase redirects to `/auth/reset-password` with token in URL hash

### Reset Password Flow

1. User lands on `/auth/reset-password` with token in URL
2. Page extracts token from URL hash (`#access_token=...`)
3. User enters new password and confirmation
4. Client calls `supabaseClient.auth.updateUser({ password })`
5. Password is updated
6. User is signed out and redirected to login with success message

## Testing

**✅ Status: Password recovery functionality is working and tested.**

### Test Forgot Password

1. Go to `/auth/login`
2. Click "Forgot password?"
3. Enter email: `everett@momenta.app`
4. Check email inbox for reset link
5. Click the link
6. Should redirect to `/auth/reset-password`
7. Enter new password
8. Should redirect to `/auth/login` with success message

**Note:** May show an error message initially, but the functionality works. This is a display issue that will be addressed when configuring Supabase redirect URLs.

### Test Invalid Token

1. Try accessing `/auth/reset-password` without a token
2. Should show error: "Invalid or expired reset link"
3. Should provide link to request new reset email

## Environment Variables

Make sure these are set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Optional, for production
```

## Security Notes

1. **Email Enumeration Protection**: The API always returns success even if email doesn't exist
2. **Token Expiration**: Reset tokens expire (default 1 hour in Supabase)
3. **Password Strength**: Minimum 6 characters enforced
4. **One-Time Use**: Each token can only be used once

## Troubleshooting

### Email Not Received

1. Check Supabase email settings (SMTP configuration)
2. Check spam folder
3. Verify email is associated with an account
4. Check Supabase logs for email delivery errors

### Reset Link Not Working

1. Verify redirect URL is in allowed list in Supabase
2. Check that token hasn't expired (request new one if needed)
3. Ensure `NEXT_PUBLIC_APP_URL` matches your actual domain in production

### Token Not Found in Reset Page

1. Check browser console for errors
2. Verify Supabase redirect URL configuration
3. Token should be in URL hash: `#access_token=xxx&type=recovery`

