# Bulk Upload Setup Guide for Dev Environment

## Overview
Bulk upload requires two things to work:
1. **Admin role in database** - User must have `role = 'admin'` in the profiles table
2. **BrightData environment variables** - Must be configured in `.env.local`

## Quick Diagnostic

Run this URL to check your setup:
```
http://localhost:3000/api/diagnostic/bulk-upload
```

This will show you:
- ✅ If you're authenticated
- ✅ If you have admin role
- ✅ If environment variables are set
- ✅ What needs to be fixed

## Step 1: Make Yourself an Admin

### Option A: Using Supabase Dashboard (Easiest)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Table Editor** → **profiles**
4. Find your user (search by email)
5. Click on the `role` field
6. Change it to `admin`
7. Save

### Option B: Using SQL Script
1. Open `scripts/setup-bulk-upload-dev.sql`
2. Update the email to your email address
3. Run the script in Supabase SQL Editor:
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the script
   - Run it

## Step 2: Configure Environment Variables

Edit `.env.local` and ensure these variables are set:

```bash
# BrightData Configuration (Required for bulk upload)
BRIGHT_DATA_API_KEY=your_api_key_here
BRIGHT_DATA_CUSTOMER_ID=your_customer_id_here
BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID=your_scraper_id_here

# Optional: Enable mock mode for testing without BrightData
BRIGHT_DATA_MOCK_MODE=true

# App URL (for webhooks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### For Mock Mode (Testing without BrightData)
If you want to test the bulk upload UI without actually calling BrightData:
```bash
BRIGHT_DATA_MOCK_MODE=true
```

This will:
- Accept bulk uploads
- Generate mock snapshot IDs
- Not actually scrape videos
- Allow you to test the UI and permissions

## Step 3: Restart Dev Server

After making changes:
```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 4: Verify Setup

1. Go to http://localhost:3000/api/diagnostic/bulk-upload
2. Check that all fields show ✅
3. Go to http://localhost:3000/upload
4. You should now see the admin tabs:
   - Single (Validated)
   - Single (Bypass) ⚡
   - Bulk (Validated)
   - Bulk (Bypass) ⚡

## Common Issues

### Issue: "Only admins can bypass validation" error
**Fix**: Your role in the database is not `admin`. Follow Step 1 above.

### Issue: "Database connection not available" error
**Fix**: Check your `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Issue: Bulk upload UI not showing
**Fix**: 
1. Make sure you're logged in
2. Check that your role is `admin` (see Step 1)
3. Clear your browser cache and reload

### Issue: "Failed to trigger BrightData dataset" error
**Fix**: 
1. Check that all `BRIGHT_DATA_*` environment variables are set
2. Or enable `BRIGHT_DATA_MOCK_MODE=true` to test without BrightData

## Testing Bulk Upload

Once setup is complete:

1. Go to http://localhost:3000/upload
2. You should see admin tabs
3. Click **Bulk (Bypass) ⚡** tab
4. Upload a CSV file with TikTok URLs (one per line)
5. Submit

### Sample CSV format:
```csv
https://www.tiktok.com/@username/video/1234567890
https://www.tiktok.com/@username/video/0987654321
https://www.tiktok.com/@username/video/1122334455
```

## Role Hierarchy

- **standard** (1 upload/day) - Regular users
- **creator** (10 uploads/day) - Content creators
- **brand** (5 uploads/day) - Brand accounts
- **admin** (unlimited uploads) - Administrators with full access

## Questions?

If you're still having issues:
1. Check the diagnostic URL: http://localhost:3000/api/diagnostic/bulk-upload
2. Check browser console for errors (F12 → Console)
3. Check terminal/server logs for errors

