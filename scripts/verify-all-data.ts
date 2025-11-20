#!/usr/bin/env tsx

/**
 * Data Verification Script
 * Verifies data completeness across all three databases
 * 
 * Usage:
 *   npx tsx scripts/verify-all-data.ts
 * 
 * Prerequisites:
 *   - .env.local with all three database credentials
 *   - Run discover-all-tables.ts first (optional, will auto-discover if not)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
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

interface TableVerification {
  table_name: string;
  target_count: number;
  schema_source_count: number;
  data_source_count: number;
  expected_total: number;
  difference: number;
  status: 'complete' | 'missing' | 'extra' | 'error' | 'not_in_target';
  target_exists: boolean;
  schema_source_exists: boolean;
  data_source_exists: boolean;
  issues: string[];
}

interface VerificationReport {
  summary: {
    total_tables: number;
    complete: number;
    missing_data: number;
    extra_data: number;
    errors: number;
    not_in_target: number;
  };
  tables: TableVerification[];
  generated_at: string;
}

async function getTableCount(supabase: any, tableName: string): Promise<{ count: number; exists: boolean; error?: string }> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist') || error.message.includes('relation')) {
        return { count: 0, exists: false };
      }
      return { count: -1, exists: false, error: error.message };
    }
    
    return { count: count || 0, exists: true };
  } catch (error) {
    return { count: -1, exists: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function verifyTable(tableName: string): Promise<TableVerification> {
  const result: TableVerification = {
    table_name: tableName,
    target_count: 0,
    schema_source_count: 0,
    data_source_count: 0,
    expected_total: 0,
    difference: 0,
    status: 'error',
    target_exists: false,
    schema_source_exists: false,
    data_source_exists: false,
    issues: [],
  };

  // Get counts from all databases
  const targetResult = await getTableCount(targetSupabase, tableName);
  result.target_count = targetResult.count;
  result.target_exists = targetResult.exists;
  if (targetResult.error) {
    result.issues.push(`Target error: ${targetResult.error}`);
  }

  if (schemaSourceSupabase) {
    const schemaSourceResult = await getTableCount(schemaSourceSupabase, tableName);
    result.schema_source_count = schemaSourceResult.count;
    result.schema_source_exists = schemaSourceResult.exists;
    if (schemaSourceResult.error) {
      result.issues.push(`Schema source error: ${schemaSourceResult.error}`);
    }
  } else {
    result.schema_source_count = 0;
    result.schema_source_exists = false;
  }

  const dataSourceResult = await getTableCount(dataSourceSupabase, tableName);
  result.data_source_count = dataSourceResult.count;
  result.data_source_exists = dataSourceResult.exists;
  if (dataSourceResult.error) {
    result.issues.push(`Data source error: ${dataSourceResult.error}`);
  }

  // Calculate expected total (sum of both sources)
  result.expected_total = Math.max(0, result.schema_source_count) + Math.max(0, result.data_source_count);

  // Determine status
  if (!result.target_exists) {
    result.status = 'not_in_target';
    result.issues.push('Table does not exist in target database');
  } else if (result.target_count < 0 || result.schema_source_count < 0 || result.data_source_count < 0) {
    result.status = 'error';
    if (result.issues.length === 0) {
      result.issues.push('Error getting table counts');
    }
  } else {
    result.difference = result.target_count - result.expected_total;
    
    if (result.difference === 0 && result.expected_total > 0) {
      result.status = 'complete';
    } else if (result.difference < 0) {
      result.status = 'missing';
      result.issues.push(`Missing ${Math.abs(result.difference)} rows (target: ${result.target_count}, expected: ${result.expected_total})`);
    } else if (result.difference > 0) {
      result.status = 'extra';
      result.issues.push(`Extra ${result.difference} rows in target (target: ${result.target_count}, expected: ${result.expected_total})`);
    } else if (result.expected_total === 0 && result.target_count === 0) {
      result.status = 'complete';
      // Table exists but is empty in all databases - this is okay
    } else {
      result.status = 'complete';
    }
  }

  return result;
}

async function verifyAllData() {
  console.log('🔍 Verifying Data Across All Databases');
  console.log('=====================================\n');

  // Try to load table discovery results, or use default list
  let tablesToVerify: string[] = [];
  const discoveryFile = resolve(process.cwd(), 'table-discovery-results.json');
  
  if (existsSync(discoveryFile)) {
    try {
      const discoveryData = JSON.parse(readFileSync(discoveryFile, 'utf-8'));
      tablesToVerify = discoveryData.allTables || [];
      console.log(`📋 Loaded ${tablesToVerify.length} tables from discovery results\n`);
    } catch (error) {
      console.log('⚠️  Could not load discovery results, using default table list\n');
    }
  }

  // If no discovery results, use known tables
  if (tablesToVerify.length === 0) {
    tablesToVerify = [
      'creators_hot', 'videos_hot', 'sounds_hot', 'hashtags_hot',
      'creators_cold', 'creator_profiles_cold', 'videos_cold', 'sounds_cold', 'hashtags_cold',
      'video_sound_facts', 'video_hashtag_facts', 'creator_video_facts', 'raw_refs', 'video_creator_mentions',
      'communities', 'community_video_memberships', 'community_creator_memberships', 'community_hashtag_memberships',
      'video_metrics_timeseries', 'creator_metrics_timeseries', 'sound_metrics_timeseries', 'hashtag_metrics_timeseries',
      'video_play_count_history',
      'leaderboards_creators', 'leaderboards_videos', 'leaderboards_sounds', 'leaderboards_hashtags',
      'rejected_videos', 'submission_metadata', 'bd_ingestions',
      'profiles', 'user_daily_quotas',
      'hashtag_daily_stats', 'creator_daily_stats', 'sound_daily_stats', 'community_daily_stats',
      'homepage_cache', 'creator_contacts', 'brand_contact_submissions', 'auth_rate_limits',
    ];
  }

  const verifications: TableVerification[] = [];
  let complete = 0;
  let missing = 0;
  let extra = 0;
  let errors = 0;
  let notInTarget = 0;

  console.log(`Verifying ${tablesToVerify.length} tables...\n`);

  for (let i = 0; i < tablesToVerify.length; i++) {
    const tableName = tablesToVerify[i];
    process.stdout.write(`[${i + 1}/${tablesToVerify.length}] ${tableName}... `);
    
    const verification = await verifyTable(tableName);
    verifications.push(verification);

    switch (verification.status) {
      case 'complete':
        complete++;
        console.log(`✅ Complete (${verification.target_count} rows)`);
        break;
      case 'missing':
        missing++;
        console.log(`⚠️  Missing ${Math.abs(verification.difference)} rows`);
        break;
      case 'extra':
        extra++;
        console.log(`⚠️  Extra ${verification.difference} rows`);
        break;
      case 'not_in_target':
        notInTarget++;
        console.log(`❌ Not in target`);
        break;
      case 'error':
        errors++;
        console.log(`❌ Error`);
        break;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const report: VerificationReport = {
    summary: {
      total_tables: tablesToVerify.length,
      complete,
      missing_data: missing,
      extra_data: extra,
      errors,
      not_in_target: notInTarget,
    },
    tables: verifications,
    generated_at: new Date().toISOString(),
  };

  // Save report
  const reportPath = resolve(process.cwd(), 'verification-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📊 Verification Summary');
  console.log('=======================\n');
  console.log(`Total tables verified: ${tablesToVerify.length}`);
  console.log(`✅ Complete: ${complete}`);
  console.log(`⚠️  Missing data: ${missing}`);
  console.log(`⚠️  Extra data: ${extra}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`❌ Not in target: ${notInTarget}`);

  if (missing > 0 || notInTarget > 0) {
    console.log('\n⚠️  Tables with issues:');
    verifications
      .filter(v => v.status === 'missing' || v.status === 'not_in_target')
      .forEach(v => {
        console.log(`\n   ${v.table_name}:`);
        v.issues.forEach(issue => console.log(`     - ${issue}`));
      });
  }

  console.log(`\n💾 Report saved to: ${reportPath}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Review verification-report.json');
  if (missing > 0 || notInTarget > 0) {
    console.log('   2. Run migrate-missing-data.ts to fill gaps');
  }
  console.log('   3. Run generate-verification-report.ts for detailed markdown report');

  return report;
}

verifyAllData().catch(console.error);

