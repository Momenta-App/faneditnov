# Environment Setup Verification

## Quick Check

After updating your `.env.local` with actual scraper IDs, verify the setup:

### 1. Check Diagnostic Endpoint

Visit: `http://localhost:3000/api/diagnostic/bulk-upload`

This will show:
- ✅ Environment variables status
- ✅ Which platforms are configured
- ✅ Any missing configuration

### 2. Check API Status

Visit: `http://localhost:3000/api/brightdata/trigger`

This will show:
- Supported platforms
- Configuration status for each platform

### 3. Test with Mock Mode (Optional)

If you want to test without real API calls, set:
```bash
BRIGHT_DATA_MOCK_MODE=true
```

This allows testing the UI and flow without actually calling Bright Data.

## Getting Your Scraper IDs from Bright Data

1. Log into your Bright Data dashboard
2. Go to **Datasets** or **Collectors**
3. Find your Instagram Post scraper
4. Copy the Dataset ID (usually starts with `z_` or similar)
5. Do the same for YouTube Shorts scraper (if you have one)

## Common Issues

### Issue: "Instagram scraper not configured"
- Make sure `BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID` has your actual scraper ID
- Restart your dev server after updating `.env.local`

### Issue: "YouTube scraper not configured"
- This is optional - you can ignore if you only want Instagram support
- If you want YouTube support, add the YouTube scraper ID

### Issue: Environment variables not loading
- Make sure `.env.local` is in the project root
- Restart the dev server: `npm run dev`
- Check that there are no typos in variable names

## Next Steps

1. ✅ Replace placeholder values with actual scraper IDs
2. ✅ Restart dev server
3. ✅ Check diagnostic endpoint
4. ✅ Test with a real Instagram URL
5. ✅ (Optional) Test with YouTube Shorts URL if configured

