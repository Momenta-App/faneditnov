#!/usr/bin/env tsx

/**
 * Migration Verification Script
 * Verifies data integrity and completeness after migration
 * 
 * Usage:
 *   npx tsx scripts/verify-migration.ts
 * 
 * Prerequisites:
 *   - .env.local with:
 *     - MIGRATION_SOURCE_SUPABASE_URL and MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY (source)
 *     - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (target)
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

const SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   MIGRATION_SOURCE_SUPABASE_URL:', SOURCE_URL ? '✅' : '❌');
  console.error('   MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY:', SOURCE_KEY ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', TARGET_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', TARGET_KEY ? '✅' : '❌');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

interface VerificationResult {
  table: string;
  sourceCount: number;
  targetCount: number;
  match: boolean;
  issues: string[];
}

async function getTableCount(supabase: any, tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return -1; // Table doesn't exist or error
    }
    
    return count || 0;
  } catch (error) {
    return -1;
  }
}

async function getSampleRows(supabase: any, tableName: string, limit: number = 5): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (error) {
      return [];
    }
    
    return data || [];
  } catch (error) {
    return [];
  }
}

async function checkForeignKeyIntegrity(
  supabase: any,
  tableName: string,
  foreignKeyColumn: string,
  referencedTable: string
): Promise<{ total: number; valid: number; invalid: number }> {
  try {
    // Get all foreign key values
    const { data, error } = await supabase
      .from(tableName)
      .select(foreignKeyColumn);
    
    if (error || !data) {
      return { total: 0, valid: 0, invalid: 0 };
    }
    
    const fkValues = [...new Set(data.map((row: any) => row[foreignKeyColumn]).filter(Boolean))];
    
    if (fkValues.length === 0) {
      return { total: 0, valid: 0, invalid: 0 };
    }
    
    // Check which values exist in referenced table
    const { data: referencedData, error: refError } = await supabase
      .from(referencedTable)
      .select(foreignKeyColumn)
      .in(foreignKeyColumn, fkValues);
    
    if (refError) {
      return { total: fkValues.length, valid: 0, invalid: fkValues.length };
    }
    
    const validValues = new Set((referencedData || []).map((row: any) => row[foreignKeyColumn]));
    const valid = fkValues.filter(v => validValues.has(v)).length;
    const invalid = fkValues.length - valid;
    
    return { total: fkValues.length, valid, invalid };
  } catch (error) {
    return { total: 0, valid: 0, invalid: 0 };
  }
}

async function verifyTable(tableName: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    table: tableName,
    sourceCount: 0,
    targetCount: 0,
    match: false,
    issues: [],
  };
  
  // Check if table exists in both databases
  result.sourceCount = await getTableCount(sourceSupabase, tableName);
  result.targetCount = await getTableCount(targetSupabase, tableName);
  
  if (result.sourceCount === -1) {
    result.issues.push('Table does not exist in source database');
    return result;
  }
  
  if (result.targetCount === -1) {
    result.issues.push('Table does not exist in target database');
    return result;
  }
  
  // Check row counts
  if (result.sourceCount !== result.targetCount) {
    result.issues.push(
      `Row count mismatch: source has ${result.sourceCount}, target has ${result.targetCount}`
    );
  } else {
    result.match = true;
  }
  
  // If table has data, check sample rows
  if (result.targetCount > 0 && result.sourceCount > 0) {
    const sourceSamples = await getSampleRows(sourceSupabase, tableName, 3);
    const targetSamples = await getSampleRows(targetSupabase, tableName, 3);
    
    if (sourceSamples.length > 0 && targetSamples.length > 0) {
      // Compare first row structure
      const sourceKeys = Object.keys(sourceSamples[0]);
      const targetKeys = Object.keys(targetSamples[0]);
      
      const missingInTarget = sourceKeys.filter(k => !targetKeys.includes(k));
      const extraInTarget = targetKeys.filter(k => !sourceKeys.includes(k));
      
      if (missingInTarget.length > 0) {
        result.issues.push(`Missing columns in target: ${missingInTarget.join(', ')}`);
      }
      
      if (extraInTarget.length > 0) {
        result.issues.push(`Extra columns in target: ${extraInTarget.join(', ')}`);
      }
    }
  }
  
  return result;
}

async function verifyMigration() {
  console.log('🔍 Migration Verification');
  console.log('=========================\n');
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  const results: VerificationResult[] = [];
  
  // Verify core tables
  console.log('📋 Verifying core tables...\n');
  
  const coreTables = [
    'creators_hot',
    'creators_cold',
    'creator_profiles_cold',
    'sounds_hot',
    'sounds_cold',
    'hashtags_hot',
    'hashtags_cold',
    'videos_hot',
    'videos_cold',
  ];
  
  for (const table of coreTables) {
    const result = await verifyTable(table);
    results.push(result);
    
    const status = result.match && result.issues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${table}: ${result.targetCount}/${result.sourceCount} rows`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
  }
  
  // Verify relationship tables
  console.log('\n📋 Verifying relationship tables...\n');
  
  const relationshipTables = [
    'video_sound_facts',
    'video_hashtag_facts',
    'creator_video_facts',
  ];
  
  for (const table of relationshipTables) {
    const result = await verifyTable(table);
    results.push(result);
    
    const status = result.match && result.issues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${table}: ${result.targetCount}/${result.sourceCount} rows`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
  }
  
  // Verify foreign key integrity
  console.log('\n📋 Verifying foreign key integrity...\n');
  
  try {
    // Check video -> creator references
    const videoCreatorCheck = await checkForeignKeyIntegrity(
      targetSupabase,
      'videos_hot',
      'creator_id',
      'creators_hot'
    );
    
    if (videoCreatorCheck.total > 0) {
      const status = videoCreatorCheck.invalid === 0 ? '✅' : '❌';
      console.log(
        `${status} videos_hot.creator_id: ${videoCreatorCheck.valid}/${videoCreatorCheck.total} valid references`
      );
      if (videoCreatorCheck.invalid > 0) {
        console.log(`   ❌ ${videoCreatorCheck.invalid} invalid creator references`);
      }
    }
    
    // Check video_sound_facts -> video references
    const videoSoundCheck = await checkForeignKeyIntegrity(
      targetSupabase,
      'video_sound_facts',
      'video_id',
      'videos_hot'
    );
    
    if (videoSoundCheck.total > 0) {
      const status = videoSoundCheck.invalid === 0 ? '✅' : '❌';
      console.log(
        `${status} video_sound_facts.video_id: ${videoSoundCheck.valid}/${videoSoundCheck.total} valid references`
      );
      if (videoSoundCheck.invalid > 0) {
        console.log(`   ❌ ${videoSoundCheck.invalid} invalid video references`);
      }
    }
    
    // Check video_sound_facts -> sound references
    const soundCheck = await checkForeignKeyIntegrity(
      targetSupabase,
      'video_sound_facts',
      'sound_id',
      'sounds_hot'
    );
    
    if (soundCheck.total > 0) {
      const status = soundCheck.invalid === 0 ? '✅' : '❌';
      console.log(
        `${status} video_sound_facts.sound_id: ${soundCheck.valid}/${soundCheck.total} valid references`
      );
      if (soundCheck.invalid > 0) {
        console.log(`   ❌ ${soundCheck.invalid} invalid sound references`);
      }
    }
    
    // Check video_hashtag_facts -> video references
    const videoHashtagVideoCheck = await checkForeignKeyIntegrity(
      targetSupabase,
      'video_hashtag_facts',
      'video_id',
      'videos_hot'
    );
    
    if (videoHashtagVideoCheck.total > 0) {
      const status = videoHashtagVideoCheck.invalid === 0 ? '✅' : '❌';
      console.log(
        `${status} video_hashtag_facts.video_id: ${videoHashtagVideoCheck.valid}/${videoHashtagVideoCheck.total} valid references`
      );
      if (videoHashtagVideoCheck.invalid > 0) {
        console.log(`   ❌ ${videoHashtagVideoCheck.invalid} invalid video references`);
      }
    }
    
    // Check video_hashtag_facts -> hashtag references
    const hashtagCheck = await checkForeignKeyIntegrity(
      targetSupabase,
      'video_hashtag_facts',
      'hashtag',
      'hashtags_hot'
    );
    
    if (hashtagCheck.total > 0) {
      const status = hashtagCheck.invalid === 0 ? '✅' : '❌';
      console.log(
        `${status} video_hashtag_facts.hashtag: ${hashtagCheck.valid}/${hashtagCheck.total} valid references`
      );
      if (hashtagCheck.invalid > 0) {
        console.log(`   ❌ ${hashtagCheck.invalid} invalid hashtag references`);
      }
    }
    
  } catch (error) {
    console.log(`⚠️  Error checking foreign keys: ${error instanceof Error ? error.message : error}`);
  }
  
  // Summary
  console.log('\n📊 Verification Summary');
  console.log('=======================\n');
  
  const allMatch = results.every(r => r.match && r.issues.length === 0);
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  if (allMatch && totalIssues === 0) {
    console.log('✅ All tables verified successfully!');
  } else {
    console.log(`⚠️  Verification completed with ${totalIssues} issue(s)`);
    console.log('\nIssues found:');
    results.forEach(result => {
      if (result.issues.length > 0) {
        console.log(`\n${result.table}:`);
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    });
  }
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Review any issues above');
  console.log('   2. Fix data integrity issues if found');
  console.log('   3. Run aggregation functions to update statistics');
  console.log('   4. Test the application with migrated data');
}

verifyMigration().catch(console.error);

