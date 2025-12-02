# Verification Background Worker Setup

## Overview

The verification system is designed to work completely in the background, even if users log off or navigate away after clicking "Verify". The system has multiple layers:

1. **Frontend Polling**: When the dialog is open, it polls the status endpoint every 10 seconds
2. **Status Endpoint Polling**: The status endpoint polls BrightData directly if webhook hasn't arrived
3. **Background Worker**: A cron job can periodically check all pending verifications

## How It Works

### 1. User Clicks Verify
- BrightData collection is triggered
- `snapshot_id` is stored in database
- `webhook_status` = `PENDING`
- `verification_status` = `PENDING`

### 2. Background Processing
The verification continues in the background regardless of user actions:

**Option A: Webhook (if configured)**
- BrightData sends webhook to `/api/brightdata/profile-webhook`
- Webhook processes verification and updates status

**Option B: Status Endpoint Polling**
- When frontend calls `/api/settings/connected-accounts/verify/status`
- Endpoint checks BrightData snapshot status directly
- If ready, downloads data and processes verification
- Updates account status in database

**Option C: Background Worker**
- Cron job calls `/api/workers/verify-accounts` periodically
- Worker checks all pending verifications
- Processes any that are ready

### 3. User Returns
- Frontend dialog resumes checking when reopened
- Status endpoint returns current verification status
- User sees updated status (VERIFIED or FAILED)

## Setting Up Background Worker (Optional but Recommended)

### Option 1: Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/workers/verify-accounts",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

This runs every 2 minutes.

### Option 2: Supabase pg_cron

Create a migration file:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule verification worker (every 2 minutes)
SELECT cron.schedule(
  'verify-accounts-worker',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/api/workers/verify-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Option 3: External Cron Service

Use a service like cron-job.org or EasyCron to call:
```
POST https://your-domain.com/api/workers/verify-accounts
Authorization: Bearer YOUR_CRON_SECRET
```

Set `CRON_SECRET` in your environment variables for security.

## Environment Variables

```env
# Required
BRIGHT_DATA_API_KEY=your_key_here

# Optional (for cron job security)
CRON_SECRET=your_random_secret_here
```

## Testing

### Test Background Worker Manually

```bash
curl -X POST https://your-domain.com/api/workers/verify-accounts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Status Endpoint

```bash
curl https://your-domain.com/api/settings/connected-accounts/verify/status?account_id=ACCOUNT_ID \
  -H "Authorization: Bearer USER_TOKEN"
```

## Flow Diagram

```
User clicks Verify
    ↓
BrightData triggered
    ↓
snapshot_id stored
    ↓
┌─────────────────────────────────────┐
│  Background Processing (3 options)  │
├─────────────────────────────────────┤
│ 1. Webhook arrives → Process        │
│ 2. Status endpoint → Poll & Process │
│ 3. Background worker → Poll & Process│
└─────────────────────────────────────┘
    ↓
Status updated in database
    ↓
User sees result when they return
```

## Key Features

✅ **Works offline**: Verification continues even if user logs off  
✅ **Resumable**: Frontend resumes checking when dialog reopened  
✅ **Multiple fallbacks**: Webhook → Status polling → Background worker  
✅ **No data loss**: All status stored in database  
✅ **Timeout protection**: 3-minute timeout prevents infinite waiting  

## Troubleshooting

### Verification stuck in PENDING
1. Check if BrightData snapshot is ready: `GET /api/workers/verify-accounts` (health check)
2. Manually trigger worker: `POST /api/workers/verify-accounts`
3. Check logs for errors

### Webhook not arriving
- This is fine! The status endpoint polls BrightData directly
- Background worker also handles this

### Status not updating
- Check database: `webhook_status` and `verification_status` columns
- Verify BrightData API key is configured
- Check snapshot_id exists in database

