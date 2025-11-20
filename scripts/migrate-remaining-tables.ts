#!/usr/bin/env tsx

/**
 * Migrate Remaining Tables
 * Migrates videos_cold and relationship tables now that videos_hot exists
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

async function migrateTable(tableName: string, filterFn?: (row: any) => boolean) {
  console.log(`\n📋 Migrating: ${tableName}`);
  
  let offset = 0;
  let migrated = 0;
  let errors = 0;
  
  // Get valid video IDs for filtering
  const { data: validVideos } = await targetSupabase
    .from('videos_hot')
    .select('video_id');
  const videoIdSet = new Set((validVideos || []).map((v: any) => v.video_id));
  
  while (true) {
    const { data, error } = await sourceSupabase
      .from(tableName)
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error || !data || data.length === 0) {
      break;
    }
    
    // Filter rows if needed (e.g., only videos that exist)
    let rowsToInsert = data;
    if (filterFn) {
      rowsToInsert = data.filter(filterFn);
    } else if (tableName.includes('video') && !tableName.includes('creator')) {
      // Filter by valid video_id
      rowsToInsert = data.filter((row: any) => {
        const videoId = row.video_id;
        return videoId && videoIdSet.has(videoId);
      });
    }
    
    if (rowsToInsert.length === 0) {
      offset += BATCH_SIZE;
      continue;
    }
    
    const { error: insertError } = await targetSupabase
      .from(tableName)
      .upsert(rowsToInsert, { onConflict: tableName.includes('facts') ? 'id' : undefined });
    
    if (insertError) {
      console.log(`   ⚠️  Error at offset ${offset}: ${insertError.message}`);
      errors += rowsToInsert.length;
    } else {
      migrated += rowsToInsert.length;
      if (migrated % 1000 === 0 || offset === 0) {
        console.log(`   ✅ Migrated: ${migrated} rows`);
      }
    }
    
    offset += BATCH_SIZE;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`   ✅ Complete: ${migrated} rows, ${errors} errors`);
  return { migrated, errors };
}

async function migrateRemaining() {
  console.log('🚀 Migrating Remaining Tables');
  console.log('==============================\n');
  
  const results: any = {};
  
  // Videos cold (only for videos that exist)
  results.videos_cold = await migrateTable('videos_cold');
  
  // Relationship tables
  results.video_sound_facts = await migrateTable('video_sound_facts');
  results.video_hashtag_facts = await migrateTable('video_hashtag_facts');
  results.video_play_count_history = await migrateTable('video_play_count_history');
  
  // Communities (if they exist)
  results.communities = await migrateTable('communities', () => true);
  results.community_video_memberships = await migrateTable('community_video_memberships');
  results.community_creator_memberships = await migrateTable('community_creator_memberships');
  results.community_hashtag_memberships = await migrateTable('community_hashtag_memberships');
  
  console.log('\n📊 Summary:');
  Object.entries(results).forEach(([table, stats]: [string, any]) => {
    console.log(`   ${table}: ${stats.migrated} migrated, ${stats.errors} errors`);
  });
}

migrateRemaining().catch(console.error);

