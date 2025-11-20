# Supabase Authentication Setup

This app now uses Supabase's built-in authentication with an invite code requirement for signup.

## Configuration Steps

### 1. Disable Email Confirmation in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Settings**
3. Under **Email Auth**, find **"Enable email confirmations"**
4. **Disable** email confirmations (toggle it OFF)
5. This allows users to sign up and immediately use the app without email verification

### 2. Set the Invite Code

Add this to your `.env.local` file:

```bash
SIGNUP_INVITE_CODE=your-secure-random-code-here
```

**Important:** 
- Use a strong, random string (at least 16 characters)
- Never commit this to version control
- Only share this code with people you want to allow to create accounts

Example of generating a secure code:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Or use a password generator
```

### 3. Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SIGNUP_INVITE_CODE=your-secure-invite-code
```

## How It Works

1. **Signup**: Users must provide:
   - Email
   - Password (meeting requirements)
   - Display name (optional)
   - **Invite code** (required)

2. **Invite Code Validation**: The invite code is checked server-side against `SIGNUP_INVITE_CODE` environment variable

3. **No Email Verification**: Users can immediately log in after signup (if email confirmation is disabled in Supabase)

4. **Authentication**: Uses Supabase's built-in session management with secure cookies

## Security Notes

- The invite code is stored in environment variables (server-side only)
- The invite code is never exposed to the client
- Failed signup attempts are rate-limited
- Password requirements are enforced (8+ chars, uppercase, lowercase, number)

## Troubleshooting

If signup fails:
1. Check that `SIGNUP_INVITE_CODE` is set in `.env.local`
2. Verify the invite code matches exactly (case-sensitive)
3. Check Supabase dashboard to ensure email confirmation is disabled
4. Check server logs for detailed error messages

