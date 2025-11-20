# Database Migration Guide

This guide walks you through migrating and restructuring the target database using data from two source databases.

## Overview

- **Target Database**: `https://ojrbwvuxrsgdtmgrkoeh.supabase.co` (will be wiped and restructured)
- **Schema Source**: `https://hflcevjepybupsxsqrqg.supabase.co` (has the correct structure)
- **Data Source**: `https://sokgzgxgajjulwiisjop.supabase.co` (has TikTok data to migrate)

## Prerequisites

1. All three database credentials configured in `.env.local`
2. Access to all three Supabase projects
3. Node.js and TypeScript installed
4. Read the plan in `database-migration-and-restructure-plan.plan.md`

## Environment Setup

Update your `.env.local` file with all three database credentials:

```bash
# Target Database (will be wiped)
NEXT_PUBLIC_SUPABASE_URL=https://ojrbwvuxrsgdtmgrkoeh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-target-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-target-service-role-key

# Schema Source Database
SOURCE_SUPABASE_URL=https://hflcevjepybupsxsqrqg.supabase.co
SOURCE_SUPABASE_ANON_KEY=your-source-anon-key
SOURCE_SUPABASE_SERVICE_ROLE_KEY=your-source-service-role-key

# Data Source Database
MIGRATION_SOURCE_SUPABASE_URL=https://sokgzgxgajjulwiisjop.supabase.co
MIGRATION_SOURCE_SUPABASE_ANON_KEY=your-migration-source-anon-key
MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY=your-migration-source-service-role-key
```

## Migration Steps

### Step 1: Export Schema from Source Database

Export the complete schema from the source database that has the correct structure:

```bash
npx tsx scripts/export-schema.ts
```

This will create `sql/exported_schema_from_source.sql` with queries to extract the schema.

**Note**: If the automatic export doesn't work, you can:
- Use `pg_dump` directly if you have database access
- Or manually copy the schema from the source database's SQL Editor

### Step 2: (Optional) Backup Target Database

Before wiping, consider backing up the current target database state:

1. Go to Supabase Dashboard → SQL Editor
2. Export current schema and data (if needed)

### Step 3: Wipe Target Database

**WARNING**: This will delete ALL data in the target database!

```bash
npx tsx scripts/wipe-database.ts
```

The script will:
- Wait 5 seconds for you to cancel (Ctrl+C)
- Drop all views, functions, tables, sequences, and custom types
- Preserve Supabase system tables (auth, storage, etc.)

**Alternative**: If the script fails, run this SQL manually in Supabase SQL Editor:

```sql
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  -- Drop all views
  FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') 
  LOOP
    EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
  END LOOP;
  
  -- Drop all tables
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  
  -- Drop all functions
  FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') 
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
  END LOOP;
END $$;
```

### Step 4: Apply Schema to Target Database

Apply the exported schema (or use existing migration files):

**Option A**: Use exported schema:
```bash
npx tsx scripts/apply-schema.ts sql/exported_schema_from_source.sql
```

**Option B**: Use existing migration files (recommended if schema export doesn't work):
```bash
npx tsx scripts/setup-database.ts
```

This will run all SQL migration files in the correct order.

### Step 5: Migrate TikTok Data

Migrate data from the migration source database:

```bash
npx tsx scripts/migrate-tiktok-data.ts
```

This script will:
- Connect to source database (READ-ONLY - no modifications)
- Connect to target database
- Migrate data in dependency order:
  1. Creators (hot/cold)
  2. Sounds (hot/cold)
  3. Hashtags (hot/cold)
  4. Videos (hot/cold)
  5. Relationship tables (video_sound_facts, video_hashtag_facts, etc.)
  6. Communities (if they exist)
  7. History and tracking tables

The script uses batching (1000 rows per batch) to handle large datasets efficiently.

### Step 6: Verify Migration

Verify data integrity and completeness:

```bash
npx tsx scripts/verify-migration.ts
```

This will:
- Compare row counts between source and target
- Check foreign key integrity
- Verify table structures match
- Report any issues found

### Step 7: Post-Migration Tasks

After migration is complete:

1. **Run aggregation functions** (if needed):
   ```sql
   -- In Supabase SQL Editor
   SELECT update_all_aggregates();
   ```

2. **Update statistics**:
   ```sql
   ANALYZE;
   ```

3. **Test the application** with migrated data

4. **Verify in Supabase Dashboard**:
   - Check table row counts
   - Test sample queries
   - Verify relationships

## Troubleshooting

### Schema Export Fails

If `export-schema.ts` doesn't work:
- Use `pg_dump` directly: `pg_dump -h db.hflcevjepybupsxsqrqg.supabase.co -U postgres -d postgres --schema-only > sql/exported_schema_from_source.sql`
- Or manually copy schema from source database SQL Editor

### Wipe Script Fails

If automatic wipe fails:
- Run the SQL manually in Supabase SQL Editor (see Step 3)
- Or use Supabase Dashboard to drop tables manually

### Schema Application Fails

If `apply-schema.ts` fails:
- Use `setup-database.ts` instead (uses existing migration files)
- Or run SQL files manually in Supabase SQL Editor in the order specified in `MIGRATION_ORDER.txt`

### Data Migration Errors

If data migration fails:
- Check error messages for specific table/row issues
- Verify foreign key constraints are satisfied
- Check that all dependent tables were migrated first
- Review the migration output for specific error details

### Foreign Key Violations

If foreign key checks fail:
- Ensure data was migrated in the correct order
- Check that all parent records exist before child records
- Verify no data was skipped during migration

## Safety Notes

- **Source databases are never modified** - all operations are READ-ONLY
- **Target database is completely wiped** - ensure you have backups if needed
- **Test on a staging database first** if possible
- **Monitor the migration progress** - large datasets may take time

## Script Reference

- `scripts/export-schema.ts` - Exports schema from source database
- `scripts/wipe-database.ts` - Wipes target database safely
- `scripts/apply-schema.ts` - Applies schema to target database
- `scripts/migrate-tiktok-data.ts` - Migrates TikTok data from source to target
- `scripts/verify-migration.ts` - Verifies migration integrity

## Support

If you encounter issues:
1. Review the error messages carefully
2. Check the Supabase Dashboard for database state
3. Verify all environment variables are set correctly
4. Consult the plan document for detailed steps

