#!/usr/bin/env tsx

/**
 * Complete Migration Script
 * Finishes migrating remaining data with proper filtering
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

const SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

const BATCH_SIZE = 1000;

async function getValidIds(tableName: string, idColumn: string): Promise<Set<string>> {
  const allIds = new Set<string>();
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await targetSupabase
      .from(tableName)
      .select(idColumn)
      .range(offset, offset + batchSize - 1);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    data.forEach((row: any) => allIds.add(row[idColumn]));
    
    if (data.length < batchSize) {
      break;
    }
    
    offset += batchSize;
  }
  
  return allIds;
}

async function migrateTableWithFilter(
  tableName: string,
  filterColumn: string,
  validIds: Set<string>
) {
  console.log(`\n📋 Migrating: ${tableName}`);
  
  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  while (true) {
    const { data, error } = await sourceSupabase
      .from(tableName)
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    // Filter to only include rows with valid foreign keys
    const rowsToInsert = data.filter((row: any) => {
      const id = row[filterColumn];
      return id && validIds.has(id);
    });
    
    skipped += data.length - rowsToInsert.length;
    
    if (rowsToInsert.length === 0) {
      offset += BATCH_SIZE;
      continue;
    }
    
    // Use upsert with appropriate conflict resolution
    const conflictColumn = tableName.includes('facts') ? 'id' : 
                          tableName.includes('cold') ? 'video_id' :
                          undefined;
    
    const { error: insertError } = await targetSupabase
      .from(tableName)
      .upsert(rowsToInsert, { 
        onConflict: conflictColumn,
        ignoreDuplicates: false 
      });
    
    if (insertError) {
      console.log(`   ⚠️  Error at offset ${offset}: ${insertError.message.substring(0, 100)}`);
      errors += rowsToInsert.length;
    } else {
      migrated += rowsToInsert.length;
      if (migrated % 1000 === 0 || offset === 0) {
        console.log(`   ✅ Migrated: ${migrated} rows (skipped: ${skipped})`);
      }
    }
    
    offset += BATCH_SIZE;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`   ✅ Complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors };
}

async function completeMigration() {
  console.log('🚀 Completing Migration');
  console.log('=======================\n');
  
  // Get valid IDs for filtering
  console.log('📊 Loading valid IDs for filtering...');
  const validVideoIds = await getValidIds('videos_hot', 'video_id');
  const validSoundIds = await getValidIds('sounds_hot', 'sound_id');
  const validHashtags = await getValidIds('hashtags_hot', 'hashtag');
  
  console.log(`   ✅ Valid videos: ${validVideoIds.size}`);
  console.log(`   ✅ Valid sounds: ${validSoundIds.size}`);
  console.log(`   ✅ Valid hashtags: ${validHashtags.size}\n`);
  
  const results: any = {};
  
  // Complete videos_cold (filter by valid video_id)
  results.videos_cold = await migrateTableWithFilter('videos_cold', 'video_id', validVideoIds);
  
  // Complete video_sound_facts (filter by valid video_id and sound_id)
  console.log(`\n📋 Migrating: video_sound_facts (with dual filter)`);
  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  while (true) {
    const { data, error } = await sourceSupabase
      .from('video_sound_facts')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    // Filter by both video_id and sound_id
    const rowsToInsert = data.filter((row: any) => {
      return validVideoIds.has(row.video_id) && validSoundIds.has(row.sound_id);
    });
    
    skipped += data.length - rowsToInsert.length;
    
    if (rowsToInsert.length > 0) {
      const { error: insertError } = await targetSupabase
        .from('video_sound_facts')
        .upsert(rowsToInsert, { onConflict: 'id' });
      
      if (insertError) {
        errors += rowsToInsert.length;
      } else {
        migrated += rowsToInsert.length;
        if (migrated % 1000 === 0) {
          console.log(`   ✅ Migrated: ${migrated} rows`);
        }
      }
    }
    
    offset += BATCH_SIZE;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  results.video_sound_facts = { migrated, skipped, errors };
  console.log(`   ✅ Complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  
  // Complete video_hashtag_facts (filter by valid video_id and hashtag)
  results.video_hashtag_facts = await migrateTableWithFilter('video_hashtag_facts', 'video_id', validVideoIds);
  
  // For video_hashtag_facts, also need to filter by hashtag
  console.log(`\n📋 Migrating: video_hashtag_facts (additional hashtag filter)`);
  offset = 0;
  migrated = 0;
  skipped = 0;
  errors = 0;
  
  // Get current count
  const { count: currentCount } = await targetSupabase
    .from('video_hashtag_facts')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   Current rows in target: ${currentCount}`);
  
  while (true) {
    const { data, error } = await sourceSupabase
      .from('video_hashtag_facts')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    // Filter by both video_id and hashtag
    const rowsToInsert = data.filter((row: any) => {
      return validVideoIds.has(row.video_id) && validHashtags.has(row.hashtag);
    });
    
    skipped += data.length - rowsToInsert.length;
    
    if (rowsToInsert.length > 0) {
      const { error: insertError } = await targetSupabase
        .from('video_hashtag_facts')
        .upsert(rowsToInsert, { onConflict: 'id' });
      
      if (insertError) {
        errors += rowsToInsert.length;
      } else {
        migrated += rowsToInsert.length;
        if (migrated % 5000 === 0) {
          console.log(`   ✅ Migrated: ${migrated} rows`);
        }
      }
    }
    
    offset += BATCH_SIZE;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  results.video_hashtag_facts_final = { migrated, skipped, errors };
  console.log(`   ✅ Complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  
  // Complete video_play_count_history
  results.video_play_count_history = await migrateTableWithFilter('video_play_count_history', 'video_id', validVideoIds);
  
  console.log('\n📊 Final Summary:');
  console.log('================');
  Object.entries(results).forEach(([table, stats]: [string, any]) => {
    console.log(`   ${table}:`);
    console.log(`      ✅ Migrated: ${stats.migrated}`);
    console.log(`      ⚠️  Skipped: ${stats.skipped || 0}`);
    console.log(`      ❌ Errors: ${stats.errors || 0}`);
  });
  
  console.log('\n✅ Migration completion finished!');
}

completeMigration().catch(console.error);

