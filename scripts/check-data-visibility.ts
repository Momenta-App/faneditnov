#!/usr/bin/env tsx

/**
 * Check Data Visibility Script
 * Verifies that data is accessible and visible
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
const TARGET_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_ANON_KEY || !TARGET_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const anonClient = createClient(TARGET_URL, TARGET_ANON_KEY);
const adminClient = createClient(TARGET_URL, TARGET_KEY);

async function checkTable(tableName: string, useAnon: boolean = true) {
  const client = useAnon ? anonClient : adminClient;
  
  try {
    const { data, error, count } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: false })
      .limit(5);
    
    if (error) {
      return { success: false, error: error.message, count: 0 };
    }
    
    return { success: true, count: count || 0, sample: data?.length || 0 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', count: 0 };
  }
}

async function checkDataVisibility() {
  console.log('🔍 Checking Data Visibility');
  console.log('==========================\n');
  
  console.log('📊 Using ANON key (what frontend sees):\n');
  
  const tables = [
    'videos_hot',
    'creators_hot',
    'sounds_hot',
    'hashtags_hot',
    'communities',
    'video_sound_facts',
    'video_hashtag_facts',
  ];
  
  for (const table of tables) {
    const result = await checkTable(table, true);
    if (result.success) {
      console.log(`✅ ${table}: ${result.count} rows (can read ${result.sample} sample rows)`);
    } else {
      console.log(`❌ ${table}: Error - ${result.error}`);
    }
  }
  
  console.log('\n📊 Using SERVICE ROLE key (what API sees):\n');
  
  for (const table of tables) {
    const result = await checkTable(table, false);
    if (result.success) {
      console.log(`✅ ${table}: ${result.count} rows`);
    } else {
      console.log(`❌ ${table}: Error - ${result.error}`);
    }
  }
  
  // Check communities specifically
  console.log('\n📋 Communities Details:\n');
  const { data: communities, error: commError } = await adminClient
    .from('communities')
    .select('*')
    .limit(10);
  
  if (commError) {
    console.log(`❌ Error fetching communities: ${commError.message}`);
  } else if (communities && communities.length > 0) {
    console.log(`✅ Found ${communities.length} communities:`);
    communities.forEach((c: any) => {
      console.log(`   - ${c.name} (${c.slug})`);
    });
  } else {
    console.log('⚠️  No communities found in database');
    console.log('   Communities can be created via the /communities page (admin only)');
  }
}

checkDataVisibility().catch(console.error);



