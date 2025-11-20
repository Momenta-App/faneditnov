#!/usr/bin/env tsx

/**
 * Data Migration with Foreign Key Handling
 * Handles foreign key constraints by setting them to null when referenced data doesn't exist
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

const BATCH_SIZE = 2000;

async function checkExists(table: string, column: string, value: any): Promise<boolean> {
  try {
    const { data, error } = await targetSupabase
      .from(table)
      .select(column)
      .eq(column, value)
      .limit(1)
      .single();
    return !error && data !== null;
  } catch {
    return false;
  }
}

async function getValidCommunityIds(): Promise<Set<string>> {
  const { data } = await targetSupabase
    .from('communities')
    .select('id');
  return new Set((data || []).map((c: any) => c.id));
}

async function getValidProfileIds(): Promise<Set<string>> {
  const { data } = await targetSupabase
    .from('profiles')
    .select('id');
  return new Set((data || []).map((p: any) => p.id));
}

async function migrateTable(
  tableName: string,
  transformRow: (row: any, validIds?: any) => Promise<any> | any,
  skipIfExists: boolean = false,
  validIds?: any
): Promise<{ migrated: number; errors: number }> {
  const stats = { migrated: 0, errors: 0 };

  try {
    const { count: sourceCount, error: countError } = await dataSourceSupabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError || !sourceCount || sourceCount === 0) {
      console.log(`⏭️  ${tableName}: No data`);
      return stats;
    }

    const { count: targetCount } = await targetSupabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (skipIfExists && targetCount && targetCount >= sourceCount) {
      console.log(`⏭️  ${tableName}: Already complete (${targetCount} >= ${sourceCount})`);
      return stats;
    }

    if (targetCount && targetCount > 0) {
      console.log(`   Target has ${targetCount} rows, will upsert to add missing`);
    }

    console.log(`\n📋 ${tableName} (${sourceCount} rows)...`);

    let offset = 0;
    let hasMore = true;

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

      // Transform rows
      const rowsToInsert = [];
      for (const row of data) {
        try {
          const transformed = await transformRow(row, validIds);
          if (transformed) rowsToInsert.push(transformed);
        } catch (err) {
          // Skip this row
        }
      }

      if (rowsToInsert.length === 0) {
        offset += BATCH_SIZE;
        continue;
      }

      const upsertOptions: any = { ignoreDuplicates: false };
      if (conflictColumn) {
        upsertOptions.onConflict = conflictColumn;
      }

      const { error: insertError } = await targetSupabase
        .from(tableName)
        .upsert(rowsToInsert, upsertOptions);

      if (insertError) {
        stats.errors += rowsToInsert.length;
        console.log(`   ⚠️  Error: ${insertError.message.substring(0, 100)}`);
      } else {
        stats.migrated += rowsToInsert.length;
        if (stats.migrated % 5000 === 0 || offset === 0) {
          console.log(`   ✅ ${stats.migrated}/${sourceCount}`);
        }
      }

      offset += BATCH_SIZE;
    }

    console.log(`   ✅ Done: ${stats.migrated} migrated, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }

  return stats;
}

async function migrateAll() {
  console.log('🚀 Migrating with FK Handling\n');

  // Pre-fetch valid IDs for performance
  console.log('📋 Loading valid IDs...\n');
  const validCommunityIds = await getValidCommunityIds();
  const validProfileIds = await getValidProfileIds();
  console.log(`   Communities: ${validCommunityIds.size}`);
  console.log(`   Profiles: ${validProfileIds.size}\n`);

  const stats: any[] = [];

  // Profiles - skip (need auth setup)
  stats.push({
    table: 'profiles',
    ...(await migrateTable('profiles', () => null, true))
  });

  // Communities - set created_by to null if profile doesn't exist
  stats.push({
    table: 'communities',
    ...(await migrateTable('communities', (row, ids) => {
      if (row.created_by && !validProfileIds.has(row.created_by)) {
        row.created_by = null;
      }
      return row;
    }, true, validProfileIds))
  });

  // Community memberships - filter by valid community IDs
  stats.push({
    table: 'community_video_memberships',
    ...(await migrateTable('community_video_memberships', (row, ids) => {
      return validCommunityIds.has(row.community_id) ? row : null;
    }, true, validCommunityIds))
  });

  stats.push({
    table: 'community_creator_memberships',
    ...(await migrateTable('community_creator_memberships', (row, ids) => {
      return validCommunityIds.has(row.community_id) ? row : null;
    }, true, validCommunityIds))
  });

  stats.push({
    table: 'community_hashtag_memberships',
    ...(await migrateTable('community_hashtag_memberships', (row, ids) => {
      return validCommunityIds.has(row.community_id) ? row : null;
    }, true, validCommunityIds))
  });

  // Submission metadata - set submitted_by to null if profile doesn't exist
  stats.push({
    table: 'submission_metadata',
    ...(await migrateTable('submission_metadata', (row, ids) => {
      if (row.submitted_by && !validProfileIds.has(row.submitted_by)) {
        row.submitted_by = null;
      }
      return row;
    }, true, validProfileIds))
  });

  // User daily quotas - skip if profile doesn't exist
  stats.push({
    table: 'user_daily_quotas',
    ...(await migrateTable('user_daily_quotas', (row, ids) => {
      return row.user_id && validProfileIds.has(row.user_id) ? row : null;
    }, true, validProfileIds))
  });

  // Community daily stats - filter by valid community IDs
  stats.push({
    table: 'community_daily_stats',
    ...(await migrateTable('community_daily_stats', (row, ids) => {
      return row.community_id && validCommunityIds.has(row.community_id) ? row : null;
    }, true, validCommunityIds))
  });

  // Summary
  console.log('\n📊 Summary\n');
  let totalMigrated = 0;
  let totalErrors = 0;

  stats.forEach(s => {
    totalMigrated += s.migrated;
    totalErrors += s.errors;
    const icon = s.errors > 0 ? '⚠️' : s.migrated > 0 ? '✅' : '⏭️';
    console.log(`${icon} ${s.table}: ${s.migrated} migrated, ${s.errors} errors`);
  });

  console.log(`\n📈 Total: ${totalMigrated} migrated, ${totalErrors} errors\n`);
}

migrateAll().catch(console.error);

