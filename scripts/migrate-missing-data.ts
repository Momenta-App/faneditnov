#!/usr/bin/env tsx

/**
 * Missing Data Migration Script
 * Migrates missing data from source databases to target database
 * 
 * Usage:
 *   npx tsx scripts/migrate-missing-data.ts
 * 
 * Prerequisites:
 *   - .env.local with all three database credentials
 *   - Run verify-all-data.ts first to generate verification-report.json
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const { readFileSync } = require('fs');
    const content = readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

loadEnv();

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA_SOURCE_URL = process.env.SOURCE_SUPABASE_URL;
const SCHEMA_SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const DATA_SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const DATA_SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY || !DATA_SOURCE_URL || !DATA_SOURCE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Schema source is optional
const hasSchemaSource = SCHEMA_SOURCE_URL && SCHEMA_SOURCE_KEY;

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const schemaSourceSupabase = hasSchemaSource ? createClient(SCHEMA_SOURCE_URL, SCHEMA_SOURCE_KEY) : null;
const dataSourceSupabase = createClient(DATA_SOURCE_URL, DATA_SOURCE_KEY);

const BATCH_SIZE = 1000;

interface MigrationStats {
  table: string;
  source: 'schema' | 'data' | 'both';
  rows_migrated: number;
  rows_skipped: number;
  errors: number;
  error_messages: string[];
}

// Tables that should be migrated in dependency order
const MIGRATION_ORDER = [
  // Phase 1: Core entities (no dependencies)
  'creators_hot',
  'creators_cold',
  'creator_profiles_cold',
  'sounds_hot',
  'sounds_cold',
  'hashtags_hot',
  'hashtags_cold',
  // Phase 2: Videos (depends on creators)
  'videos_hot',
  'videos_cold',
  // Phase 3: Fact/relationship tables (depends on videos, creators, sounds, hashtags)
  'video_sound_facts',
  'video_hashtag_facts',
  'creator_video_facts',
  'raw_refs',
  'video_creator_mentions',
  // Phase 4: Communities (depends on videos, creators, hashtags)
  'communities',
  'community_video_memberships',
  'community_creator_memberships',
  'community_hashtag_memberships',
  // Phase 5: Time series and history
  'video_metrics_timeseries',
  'creator_metrics_timeseries',
  'sound_metrics_timeseries',
  'hashtag_metrics_timeseries',
  'video_play_count_history',
  // Phase 6: Other tables
  'rejected_videos',
  'submission_metadata',
  'bd_ingestions',
  'profiles',
  'user_daily_quotas',
  'hashtag_daily_stats',
  'creator_daily_stats',
  'sound_daily_stats',
  'community_daily_stats',
  'homepage_cache',
  'creator_contacts',
  'brand_contact_submissions',
  'auth_rate_limits',
];

function getConflictColumn(tableName: string): string | undefined {
  if (tableName.includes('facts')) {
    return 'id';
  }
  if (tableName.includes('hot')) {
    if (tableName === 'videos_hot') return 'video_id';
    if (tableName === 'creators_hot') return 'creator_id';
    if (tableName === 'sounds_hot') return 'sound_id';
    if (tableName === 'hashtags_hot') return 'hashtag';
  }
  if (tableName === 'communities') return 'id';
  if (tableName.includes('memberships')) {
    // These have unique constraints on composite keys
    return undefined;
  }
  return undefined;
}

async function migrateTableFromSource(
  tableName: string,
  sourceSupabase: any,
  sourceName: string,
  targetCount: number,
  expectedCount: number
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    table: tableName,
    source: sourceName === 'Schema Source' ? 'schema' : 'data',
    rows_migrated: 0,
    rows_skipped: 0,
    errors: 0,
    error_messages: [],
  };

  const missingCount = expectedCount - targetCount;
  if (missingCount <= 0) {
    return stats;
  }

  console.log(`\n📋 Migrating ${tableName} from ${sourceName}...`);
  console.log(`   Missing: ${missingCount} rows`);

  try {
    let offset = 0;
    let hasMore = true;
    const conflictColumn = getConflictColumn(tableName);

    while (hasMore && stats.rows_migrated < missingCount) {
      const { data, error } = await sourceSupabase
        .from(tableName)
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        stats.errors++;
        stats.error_messages.push(`Error fetching: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Insert into target using upsert to avoid duplicates
      const upsertOptions: any = { ignoreDuplicates: false };
      if (conflictColumn) {
        upsertOptions.onConflict = conflictColumn;
      }

      const { error: insertError } = await targetSupabase
        .from(tableName)
        .upsert(data, upsertOptions);

      if (insertError) {
        // Try inserting one by one to identify problematic rows
        console.log(`   ⚠️  Batch insert failed, trying individual inserts...`);
        for (const row of data) {
          const { error: singleError } = await targetSupabase
            .from(tableName)
            .upsert(row, upsertOptions);

          if (singleError) {
            stats.errors++;
            if (stats.error_messages.length < 5) {
              stats.error_messages.push(`Row error: ${singleError.message.substring(0, 100)}`);
            }
            stats.rows_skipped++;
          } else {
            stats.rows_migrated++;
          }
        }
      } else {
        stats.rows_migrated += data.length;
      }

      offset += BATCH_SIZE;
      if (stats.rows_migrated % 1000 === 0) {
        console.log(`   ✅ Migrated: ${stats.rows_migrated} rows`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`   ✅ Complete: ${stats.rows_migrated} migrated, ${stats.rows_skipped} skipped, ${stats.errors} errors`);
  } catch (error) {
    stats.errors++;
    stats.error_messages.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return stats;
}

async function migrateMissingData() {
  console.log('🚀 Migrating Missing Data');
  console.log('=========================\n');

  // Load verification report
  const reportPath = resolve(process.cwd(), 'verification-report.json');
  if (!existsSync(reportPath)) {
    console.error('❌ verification-report.json not found. Please run verify-all-data.ts first.');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  const tablesNeedingMigration = report.tables.filter((t: any) => 
    t.status === 'missing' || t.status === 'not_in_target'
  );

  if (tablesNeedingMigration.length === 0) {
    console.log('✅ No tables need migration. All data is complete!');
    return;
  }

  console.log(`Found ${tablesNeedingMigration.length} tables needing migration\n`);

  const allStats: MigrationStats[] = [];

  // Migrate tables in dependency order
  for (const tableName of MIGRATION_ORDER) {
    const tableVerification = report.tables.find((t: any) => t.table_name === tableName);
    if (!tableVerification) continue;

    if (tableVerification.status !== 'missing' && tableVerification.status !== 'not_in_target') {
      continue;
    }

    const targetCount = Math.max(0, tableVerification.target_count);
    const schemaSourceCount = Math.max(0, tableVerification.schema_source_count);
    const dataSourceCount = Math.max(0, tableVerification.data_source_count);
    const expectedTotal = schemaSourceCount + dataSourceCount;

    if (expectedTotal === 0) {
      console.log(`\n⏭️  Skipping ${tableName} (no data in sources)`);
      continue;
    }

    // Migrate from schema source if it has data
    if (hasSchemaSource && schemaSourceCount > 0 && tableVerification.schema_source_exists) {
      const stats = await migrateTableFromSource(
        tableName,
        schemaSourceSupabase!,
        'Schema Source',
        targetCount,
        expectedTotal
      );
      allStats.push(stats);
    }

    // Migrate from data source if it has data
    if (dataSourceCount > 0 && tableVerification.data_source_exists) {
      const stats = await migrateTableFromSource(
        tableName,
        dataSourceSupabase,
        'Data Source',
        targetCount + (schemaSourceCount > 0 ? schemaSourceCount : 0),
        expectedTotal
      );
      allStats.push(stats);
    }
  }

  // Summary
  console.log('\n📊 Migration Summary');
  console.log('====================\n');

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  allStats.forEach(stat => {
    totalMigrated += stat.rows_migrated;
    totalSkipped += stat.rows_skipped;
    totalErrors += stat.errors;

    const status = stat.errors > 0 ? '⚠️' : '✅';
    console.log(`${status} ${stat.table} (${stat.source}): ${stat.rows_migrated} migrated, ${stat.rows_skipped} skipped, ${stat.errors} errors`);
    if (stat.error_messages.length > 0 && stat.errors <= 5) {
      stat.error_messages.forEach(msg => console.log(`     - ${msg}`));
    }
  });

  console.log(`\n📈 Totals: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors\n`);

  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors. Review the output above.');
  }

  console.log('\n📝 Next steps:');
  console.log('   1. Run verify-all-data.ts again to confirm completeness');
  console.log('   2. Run generate-verification-report.ts for detailed report');
}

migrateMissingData().catch(console.error);

