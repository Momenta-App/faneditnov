#!/usr/bin/env tsx

/**
 * Combine Migrations Script
 * Combines all SQL migration files into a single file for easy execution
 * in Supabase SQL Editor
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const migrations = [
  '006_hot_tables.sql',
  '007_cold_tables.sql',
  '010_fact_tables.sql',
  '009_timeseries.sql',
  '008_leaderboards.sql',
  '017_communities.sql', // Must be before auth
  '018_profiles_and_auth.sql',
  '031_fix_profile_trigger_error_handling.sql',
  '014_rejected_videos.sql',
  '023_rejected_videos_enhancement.sql',
  '024_submission_metadata.sql',
  '023_admin_bypass_validation.sql',
  '013_add_play_counts.sql',
  '012_aggregation.sql',
  '015_add_missing_tables_columns.sql',
  '019_impact_score.sql',
  '020_daily_aggregation_tables.sql',
  '021_daily_aggregation_functions.sql',
  '022_backfill_daily_stats.sql',
  '024_community_membership_edit_flag.sql',
  '025_community_rejected_video_functions.sql',
  '016_sound_functions.sql',
  '027_homepage_cache.sql',
  '028_creator_contacts.sql',
  '029_brand_contact_rate_limiting.sql',
  '030_auth_rate_limiting.sql',
  '025_fix_aggregation_error_handling.sql',
];

const sqlDir = resolve(process.cwd(), 'sql');
const outputFile = resolve(process.cwd(), 'sql', 'combined_migrations.sql');

let combinedSQL = `-- Combined Migration Script
-- Generated: ${new Date().toISOString()}
-- 
-- This file contains all migration SQL files combined in the correct order.
-- Copy and paste this entire file into Supabase SQL Editor and run it.
--
-- IMPORTANT: Run this in your TARGET database (PRIMARY database)
-- Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'TARGET_DATABASE'}
--
-- ============================================================================
-- MIGRATION START
-- ============================================================================

`;

let successCount = 0;
let errorCount = 0;

for (const migration of migrations) {
  const filePath = resolve(sqlDir, migration);
  
  if (!existsSync(filePath)) {
    console.log(`⚠️  File not found: ${migration}`);
    errorCount++;
    continue;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    combinedSQL += `\n-- ============================================================================\n`;
    combinedSQL += `-- ${migration}\n`;
    combinedSQL += `-- ============================================================================\n\n`;
    combinedSQL += content;
    combinedSQL += `\n\n`;
    
    console.log(`✅ Added: ${migration}`);
    successCount++;
  } catch (error) {
    console.log(`❌ Error reading ${migration}: ${error instanceof Error ? error.message : error}`);
    errorCount++;
  }
}

combinedSQL += `\n-- ============================================================================\n`;
combinedSQL += `-- MIGRATION COMPLETE\n`;
combinedSQL += `-- ============================================================================\n`;

writeFileSync(outputFile, combinedSQL, 'utf-8');

console.log(`\n📊 Summary:`);
console.log(`   ✅ Successfully combined: ${successCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);
console.log(`\n📁 Output file: ${outputFile}`);
console.log(`\n📝 Next Steps:`);
console.log(`   1. Open Supabase Dashboard → SQL Editor`);
console.log(`   2. Select your TARGET database`);
console.log(`   3. Copy the contents of ${outputFile}`);
console.log(`   4. Paste into SQL Editor and click "Run"`);
console.log(`   5. Wait for all migrations to complete`);

