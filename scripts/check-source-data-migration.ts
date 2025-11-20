#!/usr/bin/env tsx

/**
 * Source Data Migration Verification Script
 * Checks if data from source database has been migrated to target database
 * 
 * Usage:
 *   npx tsx scripts/check-source-data-migration.ts
 * 
 * Prerequisites:
 *   - .env.local with SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY
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

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL ?? '';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables for target database');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error('❌ Missing required environment variables for source database');
  console.error('   Required: SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

interface TableCount {
  table: string;
  sourceCount: number;
  targetCount: number;
  missing: number;
  sourceIds?: string[];
  targetIds?: string[];
  missingIds?: string[];
}

interface VerificationReport {
  timestamp: string;
  sourceUrl: string;
  targetUrl: string;
  expectedCreators: number;
  expectedVideos: number;
  tables: TableCount[];
  summary: {
    allDataPresent: boolean;
    totalMissing: number;
  };
}

async function getTableCount(supabase: any, tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      // Table might not exist
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return -1; // Table doesn't exist
      }
      throw error;
    }
    
    return count || 0;
  } catch (error) {
    return -1; // Error or table doesn't exist
  }
}

async function getTableIds(supabase: any, tableName: string, idColumn: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(idColumn)
      .limit(10000); // Reasonable limit
    
    if (error) {
      return [];
    }
    
    return (data || []).map((row: any) => String(row[idColumn])).filter(Boolean);
  } catch (error) {
    return [];
  }
}

async function checkTable(
  tableName: string,
  idColumn: string,
  expectedCount?: number
): Promise<TableCount> {
  console.log(`\n📋 Checking ${tableName}...`);
  
  const sourceCount = await getTableCount(sourceSupabase, tableName);
  const targetCount = await getTableCount(targetSupabase, tableName);
  
  if (sourceCount === -1) {
    console.log(`   ⚠️  Table ${tableName} does not exist in source database`);
    return {
      table: tableName,
      sourceCount: 0,
      targetCount: targetCount === -1 ? 0 : targetCount,
      missing: 0
    };
  }
  
  if (targetCount === -1) {
    console.log(`   ⚠️  Table ${tableName} does not exist in target database`);
    return {
      table: tableName,
      sourceCount,
      targetCount: 0,
      missing: sourceCount
    };
  }
  
  console.log(`   Source: ${sourceCount} records`);
  console.log(`   Target: ${targetCount} records`);
  
  // Get IDs for comparison if counts differ
  let missingIds: string[] = [];
  if (sourceCount > targetCount) {
    console.log(`   🔍 Comparing IDs to find missing records...`);
    const sourceIds = await getTableIds(sourceSupabase, tableName, idColumn);
    const targetIds = await getTableIds(targetSupabase, tableName, idColumn);
    const targetIdsSet = new Set(targetIds);
    missingIds = sourceIds.filter(id => !targetIdsSet.has(id));
    console.log(`   Missing: ${missingIds.length} records`);
  }
  
  if (expectedCount !== undefined) {
    if (sourceCount === expectedCount) {
      console.log(`   ✅ Source has expected count (${expectedCount})`);
    } else {
      console.log(`   ⚠️  Source count (${sourceCount}) differs from expected (${expectedCount})`);
    }
  }
  
  const missing = Math.max(0, sourceCount - targetCount);
  
  return {
    table: tableName,
    sourceCount,
    targetCount,
    missing,
    missingIds: missingIds.length > 0 ? missingIds.slice(0, 100) : undefined // Limit to first 100
  };
}

async function verifyDataMigration() {
  console.log('🔍 Source Data Migration Verification');
  console.log('=====================================\n');
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    targetUrl: TARGET_URL,
    expectedCreators: 530,
    expectedVideos: 761,
    tables: [],
    summary: {
      allDataPresent: true,
      totalMissing: 0
    }
  };
  
  // Check primary tables
  const creatorsCheck = await checkTable('creators_hot', 'creator_id', 530);
  report.tables.push(creatorsCheck);
  
  const videosCheck = await checkTable('videos_hot', 'video_id', 761);
  report.tables.push(videosCheck);
  
  // Check cold tables if they exist
  const creatorProfilesCheck = await checkTable('creator_profiles_cold', 'creator_id');
  if (creatorProfilesCheck.sourceCount > 0 || creatorProfilesCheck.targetCount > 0) {
    report.tables.push(creatorProfilesCheck);
  }
  
  const videosColdCheck = await checkTable('videos_cold', 'video_id');
  if (videosColdCheck.sourceCount > 0 || videosColdCheck.targetCount > 0) {
    report.tables.push(videosColdCheck);
  }
  
  // Check related tables
  const soundsCheck = await checkTable('sounds_hot', 'sound_id');
  if (soundsCheck.sourceCount > 0 || soundsCheck.targetCount > 0) {
    report.tables.push(soundsCheck);
  }
  
  const hashtagsCheck = await checkTable('hashtags_hot', 'hashtag');
  if (hashtagsCheck.sourceCount > 0 || hashtagsCheck.targetCount > 0) {
    report.tables.push(hashtagsCheck);
  }
  
  // Calculate summary
  report.summary.totalMissing = report.tables.reduce((sum, t) => sum + t.missing, 0);
  report.summary.allDataPresent = report.summary.totalMissing === 0;
  
  // Print summary
  console.log('\n\n📊 Verification Summary');
  console.log('=======================\n');
  
  report.tables.forEach(table => {
    const status = table.missing === 0 ? '✅' : '❌';
    console.log(`${status} ${table.table}:`);
    console.log(`   Source: ${table.sourceCount}`);
    console.log(`   Target: ${table.targetCount}`);
    console.log(`   Missing: ${table.missing}`);
    if (table.missingIds && table.missingIds.length > 0) {
      console.log(`   Sample missing IDs: ${table.missingIds.slice(0, 5).join(', ')}${table.missingIds.length > 5 ? '...' : ''}`);
    }
  });
  
  console.log(`\n📈 Overall Status:`);
  if (report.summary.allDataPresent) {
    console.log(`   ✅ All data is present in target database`);
  } else {
    console.log(`   ❌ ${report.summary.totalMissing} records are missing`);
    console.log(`\n   Next steps:`);
    console.log(`   1. Run compare-schemas.ts to check for schema differences`);
    console.log(`   2. Run migrate-source-data.ts to migrate missing data`);
  }
  
  // Save report to file
  const reportPath = resolve(process.cwd(), 'source-data-verification-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);
  
  return report;
}

verifyDataMigration().catch(error => {
  console.error('❌ Error during verification:', error);
  process.exit(1);
});

