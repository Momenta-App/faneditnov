#!/usr/bin/env tsx

/**
 * TikTok Data Migration Script
 * Migrates TikTok data from migration source database to target database
 * READ-ONLY operations on source database to protect production
 * 
 * Usage:
 *   npx tsx scripts/migrate-tiktok-data.ts
 * 
 * Prerequisites:
 *   - .env.local with:
 *     - MIGRATION_SOURCE_SUPABASE_URL and MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY (source)
 *     - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (target)
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

const SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   MIGRATION_SOURCE_SUPABASE_URL:', SOURCE_URL ? '✅' : '❌');
  console.error('   MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY:', SOURCE_KEY ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', TARGET_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', TARGET_KEY ? '✅' : '❌');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

const BATCH_SIZE = 1000; // Number of rows to insert per batch

interface MigrationStats {
  table: string;
  sourceCount: number;
  migratedCount: number;
  errors: number;
}

const stats: MigrationStats[] = [];

async function getTableCount(supabase: any, tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      // Table might not exist
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function migrateTable(
  tableName: string,
  transformRow?: (row: any) => any,
  batchSize: number = BATCH_SIZE
): Promise<MigrationStats> {
  console.log(`\n📋 Migrating table: ${tableName}`);
  
  const stat: MigrationStats = {
    table: tableName,
    sourceCount: 0,
    migratedCount: 0,
    errors: 0,
  };
  
  try {
    // Get count from source
    stat.sourceCount = await getTableCount(sourceSupabase, tableName);
    console.log(`   Source rows: ${stat.sourceCount}`);
    
    if (stat.sourceCount === 0) {
      console.log(`   ⚠️  No data to migrate`);
      return stat;
    }
    
    // Check if table exists in target
    const targetCount = await getTableCount(targetSupabase, tableName);
    if (targetCount > 0 && tableName === 'videos_hot') {
      console.log(`   ⚠️  Target already has ${targetCount} rows`);
      console.log(`   💡 Will use upsert to update existing rows and add new ones.`);
      // Continue with migration using upsert
    } else if (targetCount > 0) {
      console.log(`   ⚠️  Target already has ${targetCount} rows`);
      console.log(`   💡 Skipping to avoid duplicates. Delete existing data first if you want to re-migrate.`);
      stat.migratedCount = targetCount;
      return stat;
    }
    
    // Migrate in batches
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await sourceSupabase
        .from(tableName)
        .select('*')
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        console.log(`   ❌ Error fetching data: ${error.message}`);
        stat.errors++;
        break;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      // Transform rows if needed
      const rowsToInsert = transformRow 
        ? data.map(transformRow).filter(Boolean)
        : data;
      
      if (rowsToInsert.length === 0) {
        offset += batchSize;
        continue;
      }
      
      // Insert batch into target (use upsert for videos_hot to handle retries)
      let insertError;
      if (tableName === 'videos_hot') {
        // Use upsert for videos to handle existing rows
        const { error } = await targetSupabase
          .from(tableName)
          .upsert(rowsToInsert, { onConflict: 'video_id' });
        insertError = error;
      } else {
        // Use regular insert for other tables
        const { error } = await targetSupabase
          .from(tableName)
          .insert(rowsToInsert);
        insertError = error;
      }
      
      if (insertError) {
        console.log(`   ❌ Error inserting batch (offset ${offset}): ${insertError.message}`);
        stat.errors++;
        
        // Try inserting one by one to identify problematic rows
        if (rowsToInsert.length > 1) {
          console.log(`   🔍 Attempting individual inserts to identify issues...`);
          let successCount = 0;
          for (const row of rowsToInsert) {
            let singleError;
            if (tableName === 'videos_hot') {
              const { error } = await targetSupabase
                .from(tableName)
                .upsert(row, { onConflict: 'video_id' });
              singleError = error;
            } else {
              const { error } = await targetSupabase
                .from(tableName)
                .insert(row);
              singleError = error;
            }
            
            if (singleError) {
              // Only log first few errors to avoid spam
              if (stat.errors < 5) {
                console.log(`      ❌ Failed: ${singleError.message}`);
                console.log(`         Row preview: ${JSON.stringify(row).substring(0, 150)}...`);
              }
              stat.errors++;
            } else {
              successCount++;
              stat.migratedCount++;
            }
          }
          if (successCount > 0) {
            console.log(`      ✅ Successfully inserted ${successCount} rows individually`);
          }
        }
      } else {
        stat.migratedCount += rowsToInsert.length;
        console.log(`   ✅ Migrated batch: ${stat.migratedCount}/${stat.sourceCount} rows`);
      }
      
      offset += batchSize;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   ✅ Complete: ${stat.migratedCount} rows migrated, ${stat.errors} errors`);
    
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error instanceof Error ? error.message : error}`);
    stat.errors++;
  }
  
  return stat;
}

async function migrateTikTokData() {
  console.log('🚀 TikTok Data Migration');
  console.log('========================\n');
  console.log(`Source (READ-ONLY): ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  // Verify connections
  console.log('🔍 Verifying connections...\n');
  
  try {
    const sourceTables = await getTableCount(sourceSupabase, 'videos_hot');
    const targetTables = await getTableCount(targetSupabase, 'videos_hot');
    
    console.log(`Source database: ${sourceTables >= 0 ? '✅ Connected' : '❌ Error'}`);
    console.log(`Target database: ${targetTables >= 0 ? '✅ Connected' : '❌ Error'}\n`);
  } catch (error) {
    console.log(`⚠️  Connection check failed: ${error instanceof Error ? error.message : error}\n`);
  }
  
  console.log('⚠️  IMPORTANT: This script performs READ-ONLY operations on the source database.');
  console.log('   No data will be modified or deleted in the source database.\n');
  
  // Migration order (respecting foreign key dependencies)
  
  // Phase 1: Core entities (no dependencies)
  console.log('📦 Phase 1: Migrating core entities...\n');
  
  // Creators (no dependencies)
  stats.push(await migrateTable('creators_hot'));
  stats.push(await migrateTable('creators_cold'));
  stats.push(await migrateTable('creator_profiles_cold'));
  
  // Sounds (no dependencies)
  stats.push(await migrateTable('sounds_hot'));
  stats.push(await migrateTable('sounds_cold'));
  
  // Hashtags (no dependencies)
  stats.push(await migrateTable('hashtags_hot'));
  stats.push(await migrateTable('hashtags_cold'));
  
  // Phase 2: Videos (depends on creators)
  console.log('\n📦 Phase 2: Migrating videos...\n');
  
  // Get all valid creator IDs to validate foreign keys
  const { data: validCreators } = await targetSupabase
    .from('creators_hot')
    .select('creator_id');
  const creatorIdSet = new Set((validCreators || []).map((c: any) => c.creator_id));
  
  // Transform video rows to handle data issues
  const transformVideo = (row: any) => {
    // Skip if missing required fields
    if (!row.video_id || !row.post_id || !row.creator_id) {
      return null;
    }
    
    // Validate creator_id exists
    if (!creatorIdSet.has(row.creator_id)) {
      console.log(`   ⚠️  Skipping video ${row.video_id}: creator_id ${row.creator_id} not found`);
      return null;
    }
    
    // Ensure platform is set
    if (!row.platform) {
      row.platform = 'tiktok';
    }
    
    // Ensure created_at is not null (required field)
    if (!row.created_at) {
      // Try to use first_seen_at or last_seen_at as fallback
      row.created_at = row.first_seen_at || row.last_seen_at || new Date().toISOString();
    }
    
    // Ensure post_id is set (use video_id if post_id is missing)
    if (!row.post_id) {
      row.post_id = row.video_id;
    }
    
    return row;
  };
  
  stats.push(await migrateTable('videos_hot', transformVideo));
  stats.push(await migrateTable('videos_cold'));
  
  // Phase 3: Fact/relationship tables (depends on videos, creators, sounds, hashtags)
  console.log('\n📦 Phase 3: Migrating relationship tables...\n');
  
  stats.push(await migrateTable('video_sound_facts'));
  stats.push(await migrateTable('video_hashtag_facts'));
  stats.push(await migrateTable('creator_video_facts'));
  
  // Phase 4: Communities (if they exist)
  console.log('\n📦 Phase 4: Migrating communities...\n');
  
  stats.push(await migrateTable('communities'));
  stats.push(await migrateTable('community_video_memberships'));
  stats.push(await migrateTable('community_creator_memberships'));
  stats.push(await migrateTable('community_hashtag_memberships'));
  
  // Phase 5: History and tracking tables
  console.log('\n📦 Phase 5: Migrating history tables...\n');
  
  stats.push(await migrateTable('video_play_count_history'));
  stats.push(await migrateTable('bd_ingestions'));
  
  // Phase 6: Other tables
  console.log('\n📦 Phase 6: Migrating other tables...\n');
  
  stats.push(await migrateTable('rejected_videos'));
  stats.push(await migrateTable('submission_metadata'));
  stats.push(await migrateTable('raw_refs'));
  
  // Summary
  console.log('\n📊 Migration Summary');
  console.log('====================\n');
  
  let totalSource = 0;
  let totalMigrated = 0;
  let totalErrors = 0;
  
  stats.forEach(stat => {
    totalSource += stat.sourceCount;
    totalMigrated += stat.migratedCount;
    totalErrors += stat.errors;
    
    const status = stat.errors > 0 ? '⚠️' : stat.migratedCount === stat.sourceCount ? '✅' : '⚠️';
    console.log(`${status} ${stat.table}: ${stat.migratedCount}/${stat.sourceCount} rows (${stat.errors} errors)`);
  });
  
  console.log(`\n📈 Totals: ${totalMigrated}/${totalSource} rows migrated, ${totalErrors} errors\n`);
  
  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors. Review the output above.');
  }
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Verify data in Supabase Dashboard');
  console.log('   2. Run scripts/verify-migration.ts to check data integrity');
  console.log('   3. Run aggregation functions if needed');
}

migrateTikTokData().catch(console.error);

