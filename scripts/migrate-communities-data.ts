#!/usr/bin/env tsx

/**
 * Communities Data Migration Script
 * Migrates communities-specific data from source databases
 * 
 * Usage:
 *   npx tsx scripts/migrate-communities-data.ts
 * 
 * Prerequisites:
 *   - .env.local with all three database credentials
 */

import { existsSync } from 'fs';
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

interface CommunitiesMigrationStats {
  communities: { migrated: number; errors: number };
  video_memberships: { migrated: number; errors: number };
  creator_memberships: { migrated: number; errors: number };
  hashtag_memberships: { migrated: number; errors: number };
}

async function checkTableExists(supabase: any, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(0);
    // If no error, or error is PGRST116 (no rows), table exists
    if (!error) return true;
    if (error.code === 'PGRST116') return true;
    // If error mentions "does not exist" or "relation", table doesn't exist
    if (error.message && (error.message.includes('does not exist') || error.message.includes('relation'))) {
      return false;
    }
    // Other errors - assume table exists but might be empty
    return true;
  } catch {
    return false;
  }
}

async function getTableCount(supabase: any, tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    if (error) {
      // PGRST116 means no rows, which is fine
      if (error.code === 'PGRST116') {
        return 0;
      }
      // Other errors mean table might not exist
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

async function migrateTable(
  tableName: string,
  sourceSupabase: any,
  targetSupabase: any,
  sourceName: string,
  conflictColumn?: string
): Promise<{ migrated: number; errors: number }> {
  const stats = { migrated: 0, errors: 0 };

  try {
    const exists = await checkTableExists(sourceSupabase, tableName);
    if (!exists) {
      console.log(`   ⏭️  ${tableName} does not exist in ${sourceName}`);
      return stats;
    }

    const sourceCount = await getTableCount(sourceSupabase, tableName);
    if (sourceCount === 0) {
      console.log(`   ⏭️  ${tableName} is empty in ${sourceName}`);
      return stats;
    }

    console.log(`\n📋 Migrating ${tableName} from ${sourceName}...`);
    console.log(`   Source rows: ${sourceCount}`);

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await sourceSupabase
        .from(tableName)
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.log(`   ❌ Error fetching: ${error.message}`);
        stats.errors++;
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      const upsertOptions: any = { ignoreDuplicates: false };
      if (conflictColumn) {
        upsertOptions.onConflict = conflictColumn;
      }

      const { error: insertError } = await targetSupabase
        .from(tableName)
        .upsert(data, upsertOptions);

      if (insertError) {
        // Try individual inserts, handling foreign key issues
        for (const row of data) {
          // For communities table, handle created_by foreign key constraint
          if (tableName === 'communities' && row.created_by) {
            // Check if the profile exists
            const { data: profileExists } = await targetSupabase
              .from('profiles')
              .select('id')
              .eq('id', row.created_by)
              .single();
            
            if (!profileExists) {
              // Set created_by to null if profile doesn't exist
              row.created_by = null;
            }
          }
          
          const { error: singleError } = await targetSupabase
            .from(tableName)
            .upsert(row, upsertOptions);

          if (singleError) {
            stats.errors++;
            if (stats.errors <= 3) {
              console.log(`      ⚠️  Row error: ${singleError.message.substring(0, 100)}`);
            }
          } else {
            stats.migrated++;
          }
        }
      } else {
        stats.migrated += data.length;
      }

      offset += BATCH_SIZE;
      if (stats.migrated % 1000 === 0) {
        console.log(`   ✅ Migrated: ${stats.migrated}/${sourceCount} rows`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`   ✅ Complete: ${stats.migrated} migrated, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }

  return stats;
}

async function migrateCommunitiesData() {
  console.log('🚀 Migrating Communities Data');
  console.log('==============================\n');

  const stats: CommunitiesMigrationStats = {
    communities: { migrated: 0, errors: 0 },
    video_memberships: { migrated: 0, errors: 0 },
    creator_memberships: { migrated: 0, errors: 0 },
    hashtag_memberships: { migrated: 0, errors: 0 },
  };

  // Check if communities tables exist in sources
  console.log('🔍 Checking for communities data in source databases...\n');

  const schemaHasCommunities = hasSchemaSource ? await checkTableExists(schemaSourceSupabase!, 'communities') : false;
  const dataHasCommunities = await checkTableExists(dataSourceSupabase, 'communities');

  if (!schemaHasCommunities && !dataHasCommunities) {
    console.log('⚠️  Communities tables not found in either source database.');
    console.log('   Communities data will need to be created manually or through the application.\n');
    console.log('📝 Next steps:');
    console.log('   1. Create communities through the application UI');
    console.log('   2. Or use the backfill_community() function to populate from existing videos');
    return;
  }

  // Migrate communities table first (required for memberships)
  if (hasSchemaSource && schemaHasCommunities) {
    const result = await migrateTable('communities', schemaSourceSupabase!, targetSupabase, 'Schema Source', 'id');
    stats.communities.migrated += result.migrated;
    stats.communities.errors += result.errors;
  }

  if (dataHasCommunities) {
    const result = await migrateTable('communities', dataSourceSupabase, targetSupabase, 'Data Source', 'id');
    stats.communities.migrated += result.migrated;
    stats.communities.errors += result.errors;
  }

  // Migrate memberships (depend on communities and other tables)
  console.log('\n📦 Migrating community memberships...\n');

  // Video memberships
  if (hasSchemaSource && await checkTableExists(schemaSourceSupabase!, 'community_video_memberships')) {
    const result = await migrateTable(
      'community_video_memberships',
      schemaSourceSupabase!,
      targetSupabase,
      'Schema Source'
    );
    stats.video_memberships.migrated += result.migrated;
    stats.video_memberships.errors += result.errors;
  }

  if (await checkTableExists(dataSourceSupabase, 'community_video_memberships')) {
    const result = await migrateTable(
      'community_video_memberships',
      dataSourceSupabase,
      targetSupabase,
      'Data Source'
    );
    stats.video_memberships.migrated += result.migrated;
    stats.video_memberships.errors += result.errors;
  }

  // Creator memberships
  if (hasSchemaSource && await checkTableExists(schemaSourceSupabase!, 'community_creator_memberships')) {
    const result = await migrateTable(
      'community_creator_memberships',
      schemaSourceSupabase!,
      targetSupabase,
      'Schema Source'
    );
    stats.creator_memberships.migrated += result.migrated;
    stats.creator_memberships.errors += result.errors;
  }

  if (await checkTableExists(dataSourceSupabase, 'community_creator_memberships')) {
    const result = await migrateTable(
      'community_creator_memberships',
      dataSourceSupabase,
      targetSupabase,
      'Data Source'
    );
    stats.creator_memberships.migrated += result.migrated;
    stats.creator_memberships.errors += result.errors;
  }

  // Hashtag memberships
  if (hasSchemaSource && await checkTableExists(schemaSourceSupabase!, 'community_hashtag_memberships')) {
    const result = await migrateTable(
      'community_hashtag_memberships',
      schemaSourceSupabase!,
      targetSupabase,
      'Schema Source'
    );
    stats.hashtag_memberships.migrated += result.migrated;
    stats.hashtag_memberships.errors += result.errors;
  }

  if (await checkTableExists(dataSourceSupabase, 'community_hashtag_memberships')) {
    const result = await migrateTable(
      'community_hashtag_memberships',
      dataSourceSupabase,
      targetSupabase,
      'Data Source'
    );
    stats.hashtag_memberships.migrated += result.migrated;
    stats.hashtag_memberships.errors += result.errors;
  }

  // Summary
  console.log('\n📊 Migration Summary');
  console.log('====================\n');

  console.log(`Communities: ${stats.communities.migrated} migrated, ${stats.communities.errors} errors`);
  console.log(`Video Memberships: ${stats.video_memberships.migrated} migrated, ${stats.video_memberships.errors} errors`);
  console.log(`Creator Memberships: ${stats.creator_memberships.migrated} migrated, ${stats.creator_memberships.errors} errors`);
  console.log(`Hashtag Memberships: ${stats.hashtag_memberships.migrated} migrated, ${stats.hashtag_memberships.errors} errors`);

  const totalErrors = stats.communities.errors + stats.video_memberships.errors + 
                      stats.creator_memberships.errors + stats.hashtag_memberships.errors;

  if (totalErrors === 0) {
    console.log('\n✅ Communities migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with some errors. Review the output above.');
  }

  // Check if we need to backfill communities
  const targetCommunitiesCount = await getTableCount(targetSupabase, 'communities');
  if (targetCommunitiesCount > 0) {
    console.log('\n💡 Tip: If communities were migrated, you may want to:');
    console.log('   1. Run update_community_totals() for each community');
    console.log('   2. Or use backfill_community() to recalculate memberships from videos');
  }

  console.log('\n📝 Next steps:');
  console.log('   1. Verify communities data in target database');
  console.log('   2. Run verify-all-data.ts to confirm completeness');
  console.log('   3. Update community aggregates if needed');
}

migrateCommunitiesData().catch(console.error);

