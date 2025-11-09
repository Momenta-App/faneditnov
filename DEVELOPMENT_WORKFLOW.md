# Development Workflow Guide

This guide provides a complete workflow for safely developing on FanEdit without impacting the production environment.

## Table of Contents
- [Environment Overview](#environment-overview)
- [Initial Setup](#initial-setup)
- [Daily Development Workflow](#daily-development-workflow)
- [Testing on Dev Environment](#testing-on-dev-environment)
- [Deploying to Production](#deploying-to-production)
- [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)
- [Safety Checklist](#safety-checklist)

---

## Environment Overview

We maintain two completely separate environments:

| Environment | Branch | Supabase Project | Vercel Project | URL |
|-------------|--------|------------------|----------------|-----|
| **Production** | `main` | `fanedit-staging2` | `fanedit-prod` | https://fanedit5.vercel.app |
| **Development** | `dev` | `fanedit-dev` | `fanedit-dev` | https://fanedit-dev.vercel.app |

**Key Principle:** Never work directly on the `main` branch or production environment.

---

## Initial Setup

### 1. Create `.env.local` for Local Development

Create a file named `.env.local` in the project root with your dev credentials:

```bash
# Supabase - Use fanedit-dev credentials
NEXT_PUBLIC_SUPABASE_URL=https://[your-dev-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-dev-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-dev-service-role-key]

# BrightData (same as production)
BRIGHT_DATA_API_KEY=[your-key]
BRIGHT_DATA_CUSTOMER_ID=[your-id]
BRIGHT_DATA_TIKTOK_POST_SCRAPER_ID=[your-scraper-id]
BRIGHT_DATA_WEBHOOK_SECRET=[your-secret]

# Use mock mode locally to avoid real BrightData API calls
BRIGHT_DATA_MOCK_MODE=true

# Storage
SUPABASE_STORAGE_BUCKET=brightdata-results

# Cron
CRON_SECRET=[your-cron-secret]

# App URL - Important for webhooks!
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** Never commit `.env.local` to git!

### 2. Set Up Dev Database

Run all migrations on your `fanedit-dev` Supabase project:

**Option A: Using Supabase Dashboard**
1. Go to https://app.supabase.com
2. Select your `fanedit-dev` project
3. Navigate to SQL Editor
4. Run each file from `sql/` in order (006, 007, 008, etc.)

**Option B: Using Migration Script**
```bash
# Set environment variables first
export NEXT_PUBLIC_SUPABASE_URL=https://[your-dev-ref].supabase.co
export SUPABASE_SERVICE_ROLE_KEY=[your-dev-service-role-key]

# Make script executable
chmod +x scripts/migrate-dev.sh

# Run migrations
./scripts/migrate-dev.sh
```

### 3. Create and Push Dev Branch

```bash
# Create dev branch from current main
git checkout main
git pull origin main
git checkout -b dev
git push origin dev
```

### 4. Set Up Branch Protection (GitHub)

1. Go to your GitHub repository settings
2. Navigate to Branches → Branch protection rules
3. Add rule for `main` branch:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass
   - ✅ Include administrators
   - This prevents accidental direct pushes to production

### 5. Configure Vercel Projects

#### Production Project (fanedit-prod)
1. Go to your existing Vercel project settings
2. Settings → Git:
   - Production Branch: `main` only
   - Uncheck auto-deploy for other branches
3. Settings → Environment Variables:
   - Add `NEXT_PUBLIC_APP_URL=https://fanedit5.vercel.app`
   - Verify all production credentials are set

#### Development Project (fanedit-dev)
1. Go to https://vercel.com/new
2. Import your GitHub repository again
3. Project name: `fanedit-dev`
4. Settings → Git:
   - Production Branch: `dev`
   - Only deploy `dev` branch
5. Settings → Environment Variables:
   - Copy all variables from `.env.local`
   - Change `NEXT_PUBLIC_APP_URL=https://fanedit-dev.vercel.app`
   - Change `BRIGHT_DATA_MOCK_MODE=false` (can test real webhooks on dev deployment)

---

## Daily Development Workflow

### Starting a New Feature

```bash
# 1. Always start from dev branch
git checkout dev
git pull origin dev

# 2. Create a feature branch
git checkout -b feature/my-new-feature

# 3. Make your changes
# Edit code, add features, etc.

# 4. Test locally
npm run dev
# Visit http://localhost:3000
# Your app connects to fanedit-dev database

# 5. If you need new database schema:
# - Create a new SQL file: sql/026_my_feature.sql
# - Apply it to your local dev database (see Database Migrations below)

# 6. Commit your changes
git add .
git commit -m "Add new feature"

# 7. Push to GitHub
git push origin feature/my-new-feature

# 8. Create Pull Request
# - On GitHub, create PR from feature/my-new-feature → dev
# - NOT to main!
```

### Key Rules

- ✅ Always branch from `dev`
- ✅ Always merge feature branches into `dev` first
- ✅ Test thoroughly on dev deployment before merging to main
- ❌ Never work directly on `main`
- ❌ Never merge feature branches directly to `main`
- ❌ Never push database changes to production without testing on dev first

---

## Testing on Dev Environment

### Automatic Deployment

When you merge a PR into the `dev` branch, Vercel automatically deploys to:
- **URL:** https://fanedit-dev.vercel.app
- **Database:** fanedit-dev
- **Webhooks:** Point to dev URL automatically

### Manual Testing Checklist

1. **User Authentication**
   ```
   - Try signing up with a test account
   - Try logging in
   - Try password reset
   - Check user profile
   ```

2. **Video Upload**
   ```
   - Upload a TikTok URL
   - Verify webhook is triggered (check Vercel logs)
   - Check if video appears in database
   - Verify data appears on frontend
   ```

3. **Core Features**
   ```
   - Browse creators
   - View leaderboards
   - Test search
   - Check communities
   - Test any new features you added
   ```

4. **Database Integrity**
   ```sql
   -- In Supabase Dashboard for fanedit-dev:
   -- Check if data looks correct
   SELECT * FROM videos_hot ORDER BY created_at DESC LIMIT 10;
   SELECT * FROM creators_hot ORDER BY total_play_count DESC LIMIT 10;
   ```

### Checking Logs

**Vercel Logs:**
- Go to https://vercel.com/your-team/fanedit-dev
- Click on the latest deployment
- View "Functions" tab for API logs

**Supabase Logs:**
- Go to fanedit-dev project
- Navigate to "Logs" → "API Logs"
- Check for errors

---

## Deploying to Production

Only deploy to production after thorough testing on dev!

### Step 1: Merge Dev to Main

```bash
# 1. Make sure dev is fully tested
# 2. Create a PR: dev → main on GitHub
# 3. Review all changes carefully
# 4. Get approval if working with a team

# 5. Merge the PR on GitHub
# OR merge locally:
git checkout main
git pull origin main
git merge dev
git push origin main
```

### Step 2: Apply Database Migrations

**CRITICAL:** Always backup production database first!

```bash
# 1. Go to Supabase Dashboard for fanedit-staging2
# 2. Settings → Database → Backups → "Create backup"

# 3. Navigate to SQL Editor
# 4. Run your new migration file(s)
# For example: sql/026_my_feature.sql

# 5. Verify migration succeeded
# Check tables exist, run test queries
```

### Step 3: Verify Deployment

```bash
# 1. Vercel automatically deploys main → production
# 2. Wait for deployment to complete

# 3. Check production site
# Visit https://fanedit5.vercel.app

# 4. Test critical paths:
- Login/signup works
- Existing data still displays
- New features work correctly

# 5. Monitor logs for errors
# Vercel Dashboard → fanedit-prod → Functions
# Check for any errors in the first 10-15 minutes
```

### Step 4: Post-Deployment

```bash
# 1. Update dev branch with any production hotfixes
git checkout dev
git merge main
git push origin dev

# 2. Announce deployment to team/users if needed
# 3. Monitor production for next 24 hours
```

---

## Database Migrations

### Creating a Migration

1. **Naming Convention:**
   ```
   sql/026_feature_name.sql
   sql/027_another_feature.sql
   ```
   Use sequential numbers, descriptive names.

2. **Migration Template:**
   ```sql
   -- Migration: Add new feature
   -- Date: 2024-11-02
   -- Description: Brief description of changes
   
   BEGIN;
   
   -- Your schema changes here
   CREATE TABLE IF NOT EXISTS new_table (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Add indexes
   CREATE INDEX IF NOT EXISTS idx_new_table_created 
     ON new_table(created_at DESC);
   
   -- Mark migration as applied (optional tracking)
   INSERT INTO schema_migrations (version, name)
   VALUES (26, 'feature_name')
   ON CONFLICT (version) DO NOTHING;
   
   COMMIT;
   ```

### Applying Migrations

#### On Dev (Local Testing)
```bash
# Load dev environment
export NEXT_PUBLIC_SUPABASE_URL=[dev-url]
export SUPABASE_SERVICE_ROLE_KEY=[dev-key]

# Run migration script
./scripts/migrate-dev.sh
```

#### On Dev (Deployed)
Use Supabase Dashboard → SQL Editor

#### On Production
**ALWAYS:**
1. Backup first!
2. Test on dev first!
3. Run during low-traffic periods if possible
4. Have a rollback plan

### Rollback Strategy

If a migration fails:

```sql
-- Reverse the changes manually
-- Example:
DROP TABLE IF EXISTS new_table;
DROP INDEX IF EXISTS idx_new_table_created;

-- Or restore from backup
-- Supabase Dashboard → Settings → Database → Backups → Restore
```

---

## Troubleshooting

### "My local dev connects to production!"

Check `.env.local`:
```bash
# Should be fanedit-dev URL, not production
echo $NEXT_PUBLIC_SUPABASE_URL
# Should output: https://[dev-ref].supabase.co
```

### "Webhooks not working on dev"

1. **On localhost:** Webhooks won't work (BrightData can't reach localhost)
   - Use `BRIGHT_DATA_MOCK_MODE=true` for local testing
   - Or use ngrok for real webhook testing

2. **On deployed dev:** Check Vercel environment variables
   - `NEXT_PUBLIC_APP_URL` should be https://fanedit-dev.vercel.app
   - Check Vercel function logs for webhook calls

### "Migration failed on production"

1. **Don't panic!**
2. Check Supabase logs for exact error
3. Restore from backup if needed:
   - Supabase Dashboard → Settings → Database → Backups
4. Fix the migration file
5. Test on dev again
6. Re-apply to production

### "Accidentally pushed to main"

```bash
# If not yet deployed:
git reset --hard HEAD~1  # Undo last commit
git push origin main --force  # ONLY if safe to do so

# If already deployed:
# 1. Revert the changes
git revert HEAD
git push origin main

# 2. Check production for issues
# 3. Deploy hotfix if needed
```

---

## Safety Checklist

### Before Every Development Session
- [ ] On correct branch? (`dev` or `feature/*`, NOT `main`)
- [ ] `.env.local` points to dev database?
- [ ] Local dev server running (`npm run dev`)?

### Before Merging to Dev
- [ ] Code tested locally?
- [ ] No console errors?
- [ ] Migrations tested on dev database?
- [ ] PR reviewed (if working with team)?

### Before Merging to Main (Production)
- [ ] Fully tested on deployed dev environment?
- [ ] Database migrations tested on dev?
- [ ] Production backup created?
- [ ] Team notified of deployment?
- [ ] Ready to monitor production for issues?

### After Production Deployment
- [ ] Verify critical features work
- [ ] Check Vercel logs for errors
- [ ] Check Supabase logs
- [ ] Monitor for 24 hours
- [ ] Sync dev branch with main

---

## Quick Reference Commands

```bash
# Start development
git checkout dev
git checkout -b feature/my-feature
npm run dev

# Apply migration to dev
export NEXT_PUBLIC_SUPABASE_URL=[dev-url]
export SUPABASE_SERVICE_ROLE_KEY=[dev-key]
./scripts/migrate-dev.sh

# Push feature
git push origin feature/my-feature
# Create PR: feature/my-feature → dev on GitHub

# Deploy to production
# 1. Test on dev first!
# 2. Create PR: dev → main on GitHub
# 3. Backup production database
# 4. Merge PR
# 5. Apply migrations to production
# 6. Monitor deployment
```

---

## Environment Variable Reference

### Local Development (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=[dev-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[dev-anon]
SUPABASE_SERVICE_ROLE_KEY=[dev-service-key]
BRIGHT_DATA_MOCK_MODE=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
# ... other vars
```

### Dev Vercel Project
```bash
NEXT_PUBLIC_SUPABASE_URL=[dev-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[dev-anon]
SUPABASE_SERVICE_ROLE_KEY=[dev-service-key]
BRIGHT_DATA_MOCK_MODE=false
NEXT_PUBLIC_APP_URL=https://fanedit-dev.vercel.app
# ... other vars
```

### Production Vercel Project
```bash
NEXT_PUBLIC_SUPABASE_URL=[prod-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[prod-anon]
SUPABASE_SERVICE_ROLE_KEY=[prod-service-key]
BRIGHT_DATA_MOCK_MODE=false
NEXT_PUBLIC_APP_URL=https://fanedit5.vercel.app
# ... other vars
```

---

## Need Help?

If you run into issues:
1. Check this guide first
2. Review Vercel and Supabase logs
3. Check git branch: `git branch` (should show `dev` or `feature/*`)
4. Verify environment variables
5. Test on dev before production

**Remember:** The development environment exists so you can break things safely. When in doubt, test on dev first!

