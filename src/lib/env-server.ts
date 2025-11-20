export const envServer = {
  BRIGHT_DATA_API_KEY: process.env.BRIGHT_DATA_API_KEY!,
  BRIGHT_DATA_CUSTOMER_ID: process.env.BRIGHT_DATA_CUSTOMER_ID!,
  BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID: process.env.BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID!,
  BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID: process.env.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID!,
  BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID: process.env.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID!,
  BRIGHT_DATA_WEBHOOK_SECRET: process.env.BRIGHT_DATA_WEBHOOK_SECRET!,
  BRIGHT_DATA_MOCK_MODE: String(process.env.BRIGHT_DATA_MOCK_MODE || "false"),
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!, // server also needs these
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "brightdata-results",
  CRON_SECRET: process.env.CRON_SECRET!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  OPEN_AI_KEY: process.env.OPEN_AI_KEY!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  SIGNUP_INVITE_CODE: process.env.SIGNUP_INVITE_CODE || 'CHANGE_ME_IN_PRODUCTION',
};

// Validate required environment variables (excluding optional ones with defaults)
for (const [k, v] of Object.entries(envServer)) {
  // Skip validation for optional env vars that have defaults or are platform-specific
  if (k === 'SUPABASE_STORAGE_BUCKET' || 
      k === 'BRIGHT_DATA_MOCK_MODE' || 
      k === 'BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID' ||
      k === 'BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID' ||
      k === 'BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID' ||
      k === 'OPEN_AI_KEY' ||
      k === 'SIGNUP_INVITE_CODE') {
    continue;
  }
  if (!v) throw new Error(`Missing env ${k}`);
}
