#!/usr/bin/env tsx

/**
 * Database Setup Script
 * Runs all SQL migrations in the correct order for a fresh database
 * 
 * Usage:
 *   npx tsx scripts/setup-database.ts
 * 
 * Prerequisites:
 *   - .env.local with SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Migration files in order
const migrations = [
  '006_hot_tables.sql',
  '007_cold_tables.sql',
  '010_fact_tables.sql',
  '009_timeseries.sql',
  '008_leaderboards.sql',
  '018_profiles_and_auth.sql',
  '031_fix_profile_trigger_error_handling.sql',
  '014_rejected_videos.sql',
  '023_rejected_videos_enhancement.sql',
  '024_submission_metadata.sql',
  // Choose ONE ingestion function:
  '023_admin_bypass_validation.sql', // Standard version
  // '028_multi_platform_ingestion.sql', // Multi-platform version (uncomment if preferred)
  '013_add_play_counts.sql',
  '012_aggregation.sql',
  '015_add_missing_tables_columns.sql',
  '019_impact_score.sql',
  '020_daily_aggregation_tables.sql',
  '021_daily_aggregation_functions.sql',
  '022_backfill_daily_stats.sql',
  '017_communities.sql',
  '024_community_membership_edit_flag.sql',
  '025_community_rejected_video_functions.sql',
  '016_sound_functions.sql',
  '027_homepage_cache.sql',
  '028_creator_contacts.sql',
  '029_brand_contact_rate_limiting.sql',
  '030_auth_rate_limiting.sql',
  '025_fix_aggregation_error_handling.sql',
  // Note: 026_image_storage_setup.sql should be run AFTER creating the bucket in Supabase Dashboard
];

async function runMigration(filename: string): Promise<boolean> {
  const filePath = resolve(process.cwd(), 'sql', filename);
  
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  
  console.log(`\n📄 Running: ${filename}`);
  
  try {
    const sql = readFileSync(filePath, 'utf-8');
    
    // Split by semicolons and execute each statement
    // Note: Some functions have semicolons inside, so we need to be careful
    // For now, execute the entire file as one query
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query (may not work for all SQL)
      console.log(`   ⚠️  RPC method not available, trying direct execution...`);
      
      // For complex SQL, we'll need to use the Supabase REST API or psql
      // For now, just log that it needs manual execution
      console.log(`   ⚠️  Please run this file manually in Supabase SQL Editor`);
      console.log(`   📝 File: sql/${filename}`);
      return false;
    }
    
    console.log(`   ✅ Success`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('🚀 Database Setup Script');
  console.log('========================\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Migrations to run: ${migrations.length}\n`);
  
  console.log('⚠️  IMPORTANT:');
  console.log('   1. Create storage bucket "brightdata-results" in Supabase Dashboard first');
  console.log('   2. Set bucket to PUBLIC');
  console.log('   3. Then run sql/026_image_storage_setup.sql manually\n');
  
  const results: { file: string; success: boolean }[] = [];
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    results.push({ file: migration, success });
    
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Summary:');
  console.log('========================');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed migrations (run manually in Supabase SQL Editor):');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`   - sql/${r.file}`));
  }
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Run sql/026_image_storage_setup.sql manually (after creating bucket)');
  console.log('   2. Create your admin user profile');
  console.log('   3. Test with a sample URL upload');
}

main().catch(console.error);

