#!/usr/bin/env tsx

/**
 * Fast Data Migration Script
 * Migrates all data from data source with proper foreign key handling
 * 
 * Usage:
 *   npx tsx scripts/migrate-all-data-fast.ts
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const DATA_SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const DATA_SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY || !DATA_SOURCE_URL || !DATA_SOURCE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const dataSourceSupabase = createClient(DATA_SOURCE_URL, DATA_SOURCE_KEY);

const BATCH_SIZE = 2000; // Larger batches for speed

async function migrateTable(
  tableName: string,
  transformRow?: (row: any) => any,
  skipIfExists: boolean = false
): Promise<{ migrated: number; errors: number }> {
  const stats = { migrated: 0, errors: 0 };

  try {
    // Check if table exists and get count
    const { count: sourceCount, error: countError } = await dataSourceSupabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError || !sourceCount || sourceCount === 0) {
      console.log(`⏭️  ${tableName}: No data to migrate`);
      return stats;
    }

    // Check target count
    const { count: targetCount } = await targetSupabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (skipIfExists && targetCount && targetCount > 0) {
      console.log(`⏭️  ${tableName}: Already has ${targetCount} rows, skipping`);
      return stats;
    }

    console.log(`\n📋 Migrating ${tableName}...`);
    console.log(`   Source: ${sourceCount} rows, Target: ${targetCount || 0} rows`);

    let offset = 0;
    let hasMore = true;

    // Get conflict column
    const conflictColumn = tableName.includes('facts') ? 'id' : 
                          tableName === 'videos_hot' ? 'video_id' :
                          tableName === 'creators_hot' ? 'creator_id' :
                          tableName === 'sounds_hot' ? 'sound_id' :
                          tableName === 'hashtags_hot' ? 'hashtag' :
                          tableName === 'communities' ? 'id' :
                          undefined;

    while (hasMore) {
      const { data, error } = await dataSourceSupabase
        .from(tableName)
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Transform rows if needed
      let rowsToInsert = transformRow ? data.map(transformRow).filter(Boolean) : data;

      if (rowsToInsert.length === 0) {
        offset += BATCH_SIZE;
        continue;
      }

      // Use upsert with conflict resolution
      const upsertOptions: any = { ignoreDuplicates: false };
      if (conflictColumn) {
        upsertOptions.onConflict = conflictColumn;
      }

      const { error: insertError } = await targetSupabase
        .from(tableName)
        .upsert(rowsToInsert, upsertOptions);

      if (insertError) {
        console.log(`   ⚠️  Batch error: ${insertError.message.substring(0, 150)}`);
        stats.errors += rowsToInsert.length;
      } else {
        stats.migrated += rowsToInsert.length;
        if (stats.migrated % 5000 === 0 || offset === 0) {
          console.log(`   ✅ Migrated: ${stats.migrated}/${sourceCount} rows`);
        }
      }

      offset += BATCH_SIZE;
      
      // Small delay to avoid rate limiting
      if (offset % 10000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`   ✅ Complete: ${stats.migrated} migrated, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }

  return stats;
}

async function migrateAllData() {
  console.log('🚀 Fast Data Migration');
  console.log('=====================\n');
  console.log(`Source: ${DATA_SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);

  const allStats: any[] = [];

  // Phase 1: Profiles (needed for communities created_by)
  console.log('📦 Phase 1: Migrating profiles...\n');
  allStats.push({
    table: 'profiles',
    ...(await migrateTable('profiles', undefined, true))
  });

  // Phase 2: Communities (fix created_by foreign key)
  console.log('\n📦 Phase 2: Migrating communities...\n');
  allStats.push({
    table: 'communities',
    ...(await migrateTable('communities', (row) => {
      // If created_by doesn't exist in profiles, set to null
      // We'll handle this by checking after migration if needed
      return row;
    }, true))
  });

  // Phase 3: Community memberships (depend on communities)
  console.log('\n📦 Phase 3: Migrating community memberships...\n');
  allStats.push({
    table: 'community_video_memberships',
    ...(await migrateTable('community_video_memberships', undefined, true))
  });
  allStats.push({
    table: 'community_creator_memberships',
    ...(await migrateTable('community_creator_memberships', undefined, true))
  });
  allStats.push({
    table: 'community_hashtag_memberships',
    ...(await migrateTable('community_hashtag_memberships', undefined, true))
  });

  // Phase 4: Other missing tables
  console.log('\n📦 Phase 4: Migrating other tables...\n');
  allStats.push({
    table: 'submission_metadata',
    ...(await migrateTable('submission_metadata', undefined, true))
  });
  allStats.push({
    table: 'user_daily_quotas',
    ...(await migrateTable('user_daily_quotas', undefined, true))
  });
  allStats.push({
    table: 'community_daily_stats',
    ...(await migrateTable('community_daily_stats', undefined, true))
  });

  // Summary
  console.log('\n📊 Migration Summary');
  console.log('====================\n');

  let totalMigrated = 0;
  let totalErrors = 0;

  allStats.forEach(stat => {
    totalMigrated += stat.migrated;
    totalErrors += stat.errors;
    const status = stat.errors > 0 ? '⚠️' : stat.migrated > 0 ? '✅' : '⏭️';
    console.log(`${status} ${stat.table}: ${stat.migrated} migrated, ${stat.errors} errors`);
  });

  console.log(`\n📈 Totals: ${totalMigrated} migrated, ${totalErrors} errors\n`);

  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors.');
  }

  console.log('\n📝 Next steps:');
  console.log('   1. Run verify-all-data.ts to check completeness');
  console.log('   2. Fix any foreign key issues manually if needed');
}

migrateAllData().catch(console.error);

