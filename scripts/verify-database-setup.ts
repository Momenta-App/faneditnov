#!/usr/bin/env tsx

/**
 * Database Setup Verification Script
 * Checks if all required tables, functions, and storage are set up correctly
 * 
 * Usage:
 *   npx tsx scripts/verify-database-setup.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Load environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select('*').limit(1);
  return !error;
}

async function checkFunction(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('pg_get_function_identity_arguments', {
    function_name: name
  });
  // Alternative: query information_schema
  const { data: funcData } = await supabase
    .from('information_schema.routines')
    .select('routine_name')
    .eq('routine_name', name)
    .limit(1);
  return funcData && funcData.length > 0;
}

async function checkStorageBucket(): Promise<{ exists: boolean; public: boolean }> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error || !data) return { exists: false, public: false };
  
  const bucket = data.find(b => b.id === 'brightdata-results');
  return {
    exists: !!bucket,
    public: bucket?.public ?? false
  };
}

async function main() {
  console.log('🔍 Verifying Database Setup\n');
  console.log('='.repeat(50));
  
  const results: { category: string; item: string; status: boolean; note?: string }[] = [];
  
  // Check core tables
  console.log('\n📊 Checking Core Tables...');
  const coreTables = [
    'videos_hot', 'creators_hot', 'sounds_hot', 'hashtags_hot',
    'videos_cold', 'profiles', 'rejected_videos', 
    'submission_metadata', 'bd_ingestions'
  ];
  
  for (const table of coreTables) {
    const exists = await checkTable(table);
    results.push({ category: 'Tables', item: table, status: exists });
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }
  
  // Check functions (try to call it - if it exists, we'll get a parameter error, not a "doesn't exist" error)
  console.log('\n⚙️  Checking Functions...');
  const { error: funcError } = await supabase.rpc('ingest_brightdata_snapshot_v2', {
    p_snapshot_id: 'test',
    p_dataset_id: 'test',
    p_payload: [] as any, // Empty array as JSONB
    p_skip_validation: false
  });
  
  // If function doesn't exist, we'll get a specific error
  // If it exists but parameters are wrong, we'll get a different error
  const funcExists = !funcError || !funcError.message.includes('does not exist');
  results.push({ category: 'Functions', item: 'ingest_brightdata_snapshot_v2', status: funcExists });
  console.log(`   ${funcExists ? '✅' : '❌'} ingest_brightdata_snapshot_v2`);
  
  // Check storage
  console.log('\n💾 Checking Storage...');
  const storage = await checkStorageBucket();
  results.push({ 
    category: 'Storage', 
    item: 'brightdata-results bucket', 
    status: storage.exists,
    note: storage.exists ? (storage.public ? 'Public ✅' : 'Not public ⚠️') : undefined
  });
  console.log(`   ${storage.exists ? '✅' : '❌'} brightdata-results bucket`);
  if (storage.exists) {
    console.log(`   ${storage.public ? '✅' : '⚠️ '} Bucket is ${storage.public ? 'public' : 'not public'}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 Summary\n');
  
  const total = results.length;
  const passed = results.filter(r => r.status).length;
  const failed = results.filter(r => !r.status).length;
  
  console.log(`Total checks: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed Items:');
    results
      .filter(r => !r.status)
      .forEach(r => {
        console.log(`   - ${r.category}: ${r.item}`);
        if (r.note) console.log(`     Note: ${r.note}`);
      });
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Run missing migrations in Supabase SQL Editor');
    console.log('   2. Create storage bucket if missing');
    console.log('   3. Run verification again');
  } else {
    console.log('\n🎉 All checks passed! Database is ready.');
  }
}

main().catch(console.error);

