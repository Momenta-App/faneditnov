# Bulk Upload Webhook Fix

## Issue
Bulk uploads weren't receiving webhooks from BrightData, while single uploads worked fine.

## Root Cause
1. **Webhook URL pointing to wrong environment** - The fallback URL defaulted to production instead of dev
2. **Insufficient logging** - Hard to debug what was happening with webhooks
3. **Metadata lookup issues** - Bulk uploads might not match snapshot_id correctly

## Fixes Applied

### 1. Fixed Webhook URL Configuration (`src/app/api/brightdata/trigger/route.ts`)
- Changed fallback from `https://fanedit5.vercel.app` to `https://fanedit-dev.vercel.app`
- Added explicit environment variable priority:
  1. `NEXT_PUBLIC_APP_URL` (if set)
  2. `VERCEL_URL` (auto-set by Vercel)
  3. Dev URL fallback: `https://fanedit-dev.vercel.app`

### 2. Enhanced Logging (`src/app/api/brightdata/webhook/route.ts`)
- Added comprehensive logging when webhooks are received
- Logs payload type, snapshot_id extraction, metadata lookup
- Better error tracking for debugging

### 3. Improved Metadata Lookup
- Enhanced URL-based lookup for bulk uploads (tries up to 5 URLs)
- Better error handling when snapshot_id doesn't match
- Added warnings when metadata can't be found

### 4. Better Metadata Update Tracking
- Added logging when updating placeholder snapshot_id with actual ID
- Warns if snapshot_id update fails (critical for webhook processing)

## Next Steps

### 1. Set Environment Variable (Recommended)
Add to your `.env.local` or Vercel environment variables:
```bash
NEXT_PUBLIC_APP_URL=https://fanedit-dev.vercel.app
```

This ensures the webhook URL is always correct, even if `VERCEL_URL` changes.

### 2. Test Bulk Upload
1. Go to https://fanedit-dev.vercel.app/upload
2. Use the **Bulk (Bypass) ⚡** tab
3. Upload a CSV with TikTok URLs
4. Submit and check logs

### 3. Check Logs
After submitting a bulk upload, check your Vercel logs for:
- `🔍 DEBUG - Webhook URL being sent to BrightData:` - Should show `https://fanedit-dev.vercel.app/api/brightdata/webhook`
- `🎯 WEBHOOK RECEIVED` - Confirms webhooks are arriving
- `✅ METADATA LOOKUP - Found` - Confirms metadata is being matched

## Verification

To verify the fix is working:

1. **Check webhook URL in logs:**
   ```
   Look for: "🔍 DEBUG - Webhook URL being sent to BrightData: https://fanedit-dev.vercel.app/api/brightdata/webhook"
   ```

2. **Check if webhooks are received:**
   ```
   Look for: "🎯 WEBHOOK RECEIVED - Timestamp: ..."
   ```

3. **Check metadata matching:**
   ```
   Look for: "✅ METADATA LOOKUP - Found by snapshot_id" or "✅ METADATA LOOKUP - Found by URL"
   ```

## If Webhooks Still Don't Arrive

1. **Verify BrightData Dashboard:**
   - Check BrightData dashboard to see if webhooks are being sent
   - Check webhook delivery status

2. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Check `/api/brightdata/webhook` logs
   - Look for any errors or 404s

3. **Verify Environment Variables:**
   - Ensure `NEXT_PUBLIC_APP_URL` is set correctly in Vercel
   - Or verify `VERCEL_URL` is being set correctly

4. **Test Webhook Endpoint Manually:**
   ```bash
   curl -X POST https://fanedit-dev.vercel.app/api/brightdata/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

## Additional Notes

- Single uploads worked because they might have been using cached/correct webhook URLs
- Bulk uploads failed because the webhook URL was pointing to the wrong environment
- The fix ensures the webhook URL always points to the dev environment when not explicitly set

