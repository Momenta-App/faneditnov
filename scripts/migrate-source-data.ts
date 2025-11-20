#!/usr/bin/env tsx

/**
 * Source Data Migration Script
 * Migrates data from source database to target database
 * Handles schema transformations and foreign key dependencies
 * 
 * Usage:
 *   npx tsx scripts/migrate-source-data.ts
 * 
 * Prerequisites:
 *   - .env.local with SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY
 *   - Run check-source-data-migration.ts first to identify missing data
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

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL ?? '';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!TARGET_URL || !TARGET_KEY || !SOURCE_URL || !SOURCE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

const BATCH_SIZE = 100; // Smaller batches for reliability

interface MigrationStats {
  creators: { migrated: number; errors: number; skipped: number };
  videos: { migrated: number; errors: number; skipped: number };
}

function normalizeBioLinks(value: unknown): any {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return [];
}

function transformCreatorRow(row: any): any {
  // Map source fields to target schema
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
    bio_links: normalizeBioLinks(row.bio_links),
    is_private: row.is_private || false,
    is_business_account: row.is_business_account || false,
    first_seen_at: row.first_seen_at || row.created_at || new Date().toISOString(),
    last_seen_at: row.last_seen_at || row.updated_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function transformVideoRow(row: any): any {
  // Map source fields to target schema
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

async function migrateCreators(): Promise<{ migrated: number; errors: number; skipped: number }> {
  const stats = { migrated: 0, errors: 0, skipped: 0 };
  
  console.log('\n📦 Migrating Creators...');
  
  try {
    // Get source count
    const { count: sourceCount, error: countError } = await sourceSupabase
      .from('creators_hot')
      .select('*', { count: 'exact', head: true });
    
    if (countError || !sourceCount || sourceCount === 0) {
      console.log('   ⏭️  No creators to migrate');
      return stats;
    }
    
    console.log(`   Source: ${sourceCount} creators`);
    
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await sourceSupabase
        .from('creators_hot')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      // Process each creator
      for (const row of data) {
        try {
          // Check if already exists
          const exists = await checkRecordExists(
            targetSupabase,
            'creators_hot',
            'creator_id',
            row.creator_id
          );
          
          if (exists) {
            stats.skipped++;
            continue;
          }
          
          // Transform and insert
          const transformed = transformCreatorRow(row);
          
          const { error: insertError } = await targetSupabase
            .from('creators_hot')
            .insert(transformed);
          
          if (insertError) {
            console.log(`   ⚠️  Error migrating creator ${row.creator_id}: ${insertError.message.substring(0, 100)}`);
            stats.errors++;
          } else {
            stats.migrated++;
            if (stats.migrated % 50 === 0) {
              console.log(`   ✅ Migrated: ${stats.migrated}/${sourceCount} creators`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Error processing creator ${row.creator_id}: ${error instanceof Error ? error.message : String(error)}`);
          stats.errors++;
        }
      }
      
      offset += BATCH_SIZE;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   ✅ Complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }
  
  return stats;
}

async function migrateVideos(): Promise<{ migrated: number; errors: number; skipped: number }> {
  const stats = { migrated: 0, errors: 0, skipped: 0 };
  
  console.log('\n📦 Migrating Videos...');
  
  try {
    // Get source count
    const { count: sourceCount, error: countError } = await sourceSupabase
      .from('videos_hot')
      .select('*', { count: 'exact', head: true });
    
    if (countError || !sourceCount || sourceCount === 0) {
      console.log('   ⏭️  No videos to migrate');
      return stats;
    }
    
    console.log(`   Source: ${sourceCount} videos`);
    
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await sourceSupabase
        .from('videos_hot')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      // Process each video
      for (const row of data) {
        try {
          // Check if already exists
          const exists = await checkRecordExists(
            targetSupabase,
            'videos_hot',
            'video_id',
            row.video_id
          );
          
          if (exists) {
            stats.skipped++;
            continue;
          }
          
          // Ensure creator exists (create minimal if needed)
          const creatorExists = await checkRecordExists(
            targetSupabase,
            'creators_hot',
            'creator_id',
            row.creator_id
          );
          
          if (!creatorExists) {
            // Create minimal creator record
            const { error: creatorError } = await targetSupabase
              .from('creators_hot')
              .insert({
                creator_id: row.creator_id,
                username: row.creator_id || 'unknown',
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (creatorError) {
              console.log(`   ⚠️  Could not create creator ${row.creator_id}: ${creatorError.message.substring(0, 100)}`);
            }
          }
          
          // Transform and insert
          const transformed = transformVideoRow(row);
          
          const { error: insertError } = await targetSupabase
            .from('videos_hot')
            .insert(transformed);
          
          if (insertError) {
            console.log(`   ⚠️  Error migrating video ${row.video_id}: ${insertError.message.substring(0, 100)}`);
            stats.errors++;
          } else {
            stats.migrated++;
            if (stats.migrated % 50 === 0) {
              console.log(`   ✅ Migrated: ${stats.migrated}/${sourceCount} videos`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Error processing video ${row.video_id}: ${error instanceof Error ? error.message : String(error)}`);
          stats.errors++;
        }
      }
      
      offset += BATCH_SIZE;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   ✅ Complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
  } catch (error) {
    console.log(`   ❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    stats.errors++;
  }
  
  return stats;
}

async function migrateColdTables() {
  console.log('\n📦 Migrating Cold Tables...');
  
  // Migrate creator_profiles_cold
  try {
    const { count: sourceCount } = await sourceSupabase
      .from('creator_profiles_cold')
      .select('*', { count: 'exact', head: true });
    
    if (sourceCount && sourceCount > 0) {
      console.log(`   Migrating ${sourceCount} creator profiles...`);
      
      let offset = 0;
      let migrated = 0;
      
      while (true) {
        const { data, error } = await sourceSupabase
          .from('creator_profiles_cold')
          .select('*')
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (error || !data || data.length === 0) break;
        
        for (const row of data) {
          const exists = await checkRecordExists(
            targetSupabase,
            'creator_profiles_cold',
            'creator_id',
            row.creator_id
          );
          
          if (!exists) {
            const { error: insertError } = await targetSupabase
              .from('creator_profiles_cold')
              .insert(row);
            
            if (!insertError) migrated++;
          }
        }
        
        offset += BATCH_SIZE;
        if (offset >= sourceCount) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   ✅ Migrated ${migrated} creator profiles`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error migrating creator_profiles_cold: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Migrate videos_cold
  try {
    const { count: sourceCount } = await sourceSupabase
      .from('videos_cold')
      .select('*', { count: 'exact', head: true });
    
    if (sourceCount && sourceCount > 0) {
      console.log(`   Migrating ${sourceCount} video cold records...`);
      
      let offset = 0;
      let migrated = 0;
      
      while (true) {
        const { data, error } = await sourceSupabase
          .from('videos_cold')
          .select('*')
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (error || !data || data.length === 0) break;
        
        for (const row of data) {
          const exists = await checkRecordExists(
            targetSupabase,
            'videos_cold',
            'video_id',
            row.video_id
          );
          
          if (!exists) {
            const { error: insertError } = await targetSupabase
              .from('videos_cold')
              .insert(row);
            
            if (!insertError) migrated++;
          }
        }
        
        offset += BATCH_SIZE;
        if (offset >= sourceCount) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   ✅ Migrated ${migrated} video cold records`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error migrating videos_cold: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function migrateSourceData() {
  console.log('🚀 Source Data Migration');
  console.log('========================\n');
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  const stats: MigrationStats = {
    creators: { migrated: 0, errors: 0, skipped: 0 },
    videos: { migrated: 0, errors: 0, skipped: 0 }
  };
  
  // Phase 1: Migrate creators first (videos depend on creators)
  stats.creators = await migrateCreators();
  
  // Phase 2: Migrate videos
  stats.videos = await migrateVideos();
  
  // Phase 3: Migrate cold tables
  await migrateColdTables();
  
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
  
  const totalMigrated = stats.creators.migrated + stats.videos.migrated;
  const totalErrors = stats.creators.errors + stats.videos.errors;
  
  console.log(`\n📈 Totals: ${totalMigrated} migrated, ${totalErrors} errors\n`);
  
  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors.');
  }
  
  console.log('\n📝 Next steps:');
  console.log('   1. Run backfill-missing-data.ts to update aggregate counts');
  console.log('   2. Run check-source-data-migration.ts to verify completeness');
}

migrateSourceData().catch(error => {
  console.error('❌ Fatal error during migration:', error);
  process.exit(1);
});

