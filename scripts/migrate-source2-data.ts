#!/usr/bin/env tsx

/**
 * Migration Source2 Data Collection Script
 * Collects and migrates all data from MIGRATION_SOURCE2 database to target database
 * 
 * Usage:
 *   npx tsx scripts/migrate-source2-data.ts
 * 
 * Prerequisites:
 *   - .env.local with MIGRATION_SOURCE_SUPABASE_URL and MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync, writeFileSync } from 'fs';
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
// Try MIGRATION_SOURCE2_* first, fall back to MIGRATION_SOURCE_*
const SOURCE2_URL = process.env.MIGRATION_SOURCE2_SUPABASE_URL || process.env.MIGRATION_SOURCE_SUPABASE_URL;
const SOURCE2_KEY = process.env.MIGRATION_SOURCE2_ROLE_KEY || process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables for target database');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!SOURCE2_URL || !SOURCE2_KEY) {
  console.error('❌ Missing required environment variables for MIGRATION_SOURCE2 database');
  console.error('   Required: MIGRATION_SOURCE2_SUPABASE_URL (or MIGRATION_SOURCE_SUPABASE_URL)');
  console.error('            MIGRATION_SOURCE2_ROLE_KEY (or MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const source2Supabase = createClient(SOURCE2_URL, SOURCE2_KEY);

const BATCH_SIZE = 100;

interface MigrationStats {
  creators: { migrated: number; errors: number; skipped: number };
  videos: { migrated: number; errors: number; skipped: number };
  creatorProfiles: { migrated: number; errors: number; skipped: number };
  videoCold: { migrated: number; errors: number; skipped: number };
  sounds: { migrated: number; errors: number; skipped: number };
  hashtags: { migrated: number; errors: number; skipped: number };
}

function transformCreatorRow(row: any): any {
  return {
    creator_id: row.creator_id,
    username: row.username || row.creator_id || 'unknown',
    display_name: row.display_name || row.nickname || null,
    avatar_url: row.avatar_url || row.avatar || null,
    verified: row.verified || false,
    followers_count: row.followers_count || row.followers || 0,
    videos_count: row.videos_count || 0,
    likes_total: row.likes_total || row.total_likes || 0,
    bio: row.bio || null,
    bio_links: row.bio_links || (Array.isArray(row.bio_links) ? row.bio_links : []) || [],
    is_private: row.is_private || false,
    is_business_account: row.is_business_account || false,
    first_seen_at: row.first_seen_at || row.created_at || new Date().toISOString(),
    last_seen_at: row.last_seen_at || row.updated_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function transformVideoRow(row: any): any {
  return {
    video_id: row.video_id || row.id,
    post_id: row.post_id || row.video_id || row.id,
    creator_id: row.creator_id,
    url: row.url || null,
    caption: row.caption || row.description || null,
    description: row.description || null,
    created_at: row.created_at || row.create_time || new Date().toISOString(),
    views_count: row.views_count || row.play_count || row.views || 0,
    likes_count: row.likes_count || row.digg_count || row.likes || 0,
    comments_count: row.comments_count || row.comment_count || 0,
    shares_count: row.shares_count || row.share_count || 0,
    collect_count: row.collect_count || 0,
    duration_seconds: row.duration_seconds || row.duration || null,
    video_url: row.video_url || row.video?.url || null,
    cover_url: row.cover_url || row.cover || row.thumbnail_url || null,
    thumbnail_url: row.thumbnail_url || row.thumbnail || row.cover_url || null,
    is_ads: row.is_ads || false,
    language: row.language || null,
    region: row.region || null,
    first_seen_at: row.first_seen_at || row.created_at || new Date().toISOString(),
    last_seen_at: row.last_seen_at || row.updated_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function checkRecordExists(
  supabase: any,
  tableName: string,
  idColumn: string,
  id: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(idColumn)
      .eq(idColumn, id)
      .limit(1)
      .single();
    
    return !error && data !== null;
  } catch (error) {
    return false;
  }
}

async function migrateTable(
  tableName: string,
  idColumn: string,
  transformFn?: (row: any) => any,
  createDependencies?: (row: any) => Promise<void>
): Promise<{ migrated: number; errors: number; skipped: number }> {
  const stats = { migrated: 0, errors: 0, skipped: 0 };
  
  console.log(`\n📦 Migrating ${tableName}...`);
  
  try {
    const { count: sourceCount, error: countError } = await source2Supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (countError || !sourceCount || sourceCount === 0) {
      console.log(`   ⏭️  No ${tableName} to migrate`);
      return stats;
    }
    
    console.log(`   Source: ${sourceCount} records`);
    
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await source2Supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const row of data) {
        try {
          const recordId = row[idColumn];
          if (!recordId) {
            stats.errors++;
            continue;
          }
          
          const exists = await checkRecordExists(
            targetSupabase,
            tableName,
            idColumn,
            recordId
          );
          
          if (exists) {
            stats.skipped++;
            continue;
          }
          
          // Create dependencies if needed
          if (createDependencies) {
            await createDependencies(row);
          }
          
          // Transform and insert
          const transformed = transformFn ? transformFn(row) : row;
          
          const { error: insertError } = await targetSupabase
            .from(tableName)
            .insert(transformed);
          
          if (insertError) {
            console.log(`   ⚠️  Error migrating ${tableName} ${recordId}: ${insertError.message.substring(0, 100)}`);
            stats.errors++;
          } else {
            stats.migrated++;
            if (stats.migrated % 50 === 0) {
              console.log(`   ✅ Migrated: ${stats.migrated}/${sourceCount} records`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Error processing ${tableName} ${row[idColumn]}: ${error instanceof Error ? error.message : String(error)}`);
          stats.errors++;
        }
      }
      
      offset += BATCH_SIZE;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   ✅ Complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }
  
  return stats;
}

async function migrateSource2Data() {
  console.log('🚀 Migration Source2 Data Collection');
  console.log('====================================\n');
  console.log(`Source2: ${SOURCE2_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  const stats: MigrationStats = {
    creators: { migrated: 0, errors: 0, skipped: 0 },
    videos: { migrated: 0, errors: 0, skipped: 0 },
    creatorProfiles: { migrated: 0, errors: 0, skipped: 0 },
    videoCold: { migrated: 0, errors: 0, skipped: 0 },
    sounds: { migrated: 0, errors: 0, skipped: 0 },
    hashtags: { migrated: 0, errors: 0, skipped: 0 }
  };
  
  // Phase 1: Migrate creators first (videos depend on creators)
  stats.creators = await migrateTable(
    'creators_hot',
    'creator_id',
    transformCreatorRow
  );
  
  // Phase 2: Migrate videos (ensure creators exist)
  stats.videos = await migrateTable(
    'videos_hot',
    'video_id',
    transformVideoRow,
    async (row) => {
      // Ensure creator exists
      const creatorExists = await checkRecordExists(
        targetSupabase,
        'creators_hot',
        'creator_id',
        row.creator_id
      );
      
      if (!creatorExists) {
        await targetSupabase
          .from('creators_hot')
          .insert({
            creator_id: row.creator_id,
            username: row.creator_id || 'unknown',
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    }
  );
  
  // Phase 3: Migrate cold tables
  stats.creatorProfiles = await migrateTable(
    'creator_profiles_cold',
    'creator_id'
  );
  
  stats.videoCold = await migrateTable(
    'videos_cold',
    'video_id'
  );
  
  // Phase 4: Migrate related tables
  stats.sounds = await migrateTable(
    'sounds_hot',
    'sound_id'
  );
  
  stats.hashtags = await migrateTable(
    'hashtags_hot',
    'hashtag'
  );
  
  // Summary
  console.log('\n\n📊 Migration Summary');
  console.log('====================\n');
  
  console.log('Creators:');
  console.log(`   ✅ Migrated: ${stats.creators.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.creators.skipped}`);
  console.log(`   ❌ Errors: ${stats.creators.errors}`);
  
  console.log('\nVideos:');
  console.log(`   ✅ Migrated: ${stats.videos.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.videos.skipped}`);
  console.log(`   ❌ Errors: ${stats.videos.errors}`);
  
  console.log('\nCreator Profiles (Cold):');
  console.log(`   ✅ Migrated: ${stats.creatorProfiles.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.creatorProfiles.skipped}`);
  console.log(`   ❌ Errors: ${stats.creatorProfiles.errors}`);
  
  console.log('\nVideos (Cold):');
  console.log(`   ✅ Migrated: ${stats.videoCold.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.videoCold.skipped}`);
  console.log(`   ❌ Errors: ${stats.videoCold.errors}`);
  
  console.log('\nSounds:');
  console.log(`   ✅ Migrated: ${stats.sounds.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.sounds.skipped}`);
  console.log(`   ❌ Errors: ${stats.sounds.errors}`);
  
  console.log('\nHashtags:');
  console.log(`   ✅ Migrated: ${stats.hashtags.migrated}`);
  console.log(`   ⏭️  Skipped: ${stats.hashtags.skipped}`);
  console.log(`   ❌ Errors: ${stats.hashtags.errors}`);
  
  const totalMigrated = 
    stats.creators.migrated + 
    stats.videos.migrated + 
    stats.creatorProfiles.migrated + 
    stats.videoCold.migrated +
    stats.sounds.migrated +
    stats.hashtags.migrated;
  
  const totalErrors = 
    stats.creators.errors + 
    stats.videos.errors + 
    stats.creatorProfiles.errors + 
    stats.videoCold.errors +
    stats.sounds.errors +
    stats.hashtags.errors;
  
  console.log(`\n📈 Totals: ${totalMigrated} migrated, ${totalErrors} errors\n`);
  
  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors.');
  }
  
  console.log('\n📝 Next steps:');
  console.log('   1. Run backfill-missing-data.ts to update aggregate counts');
  console.log('   2. Run check-source-data-migration.ts to verify completeness');
  
  // Save summary to file
  const summaryPath = resolve(process.cwd(), 'migration-source2-summary.json');
  writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    source2Url: SOURCE2_URL,
    targetUrl: TARGET_URL,
    stats
  }, null, 2));
  console.log(`\n💾 Summary saved to: ${summaryPath}`);
}

migrateSource2Data().catch(error => {
  console.error('❌ Fatal error during migration:', error);
  process.exit(1);
});

