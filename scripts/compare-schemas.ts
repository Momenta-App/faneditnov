#!/usr/bin/env tsx

/**
 * Schema Comparison Script
 * Compares table structures between source and target databases
 * 
 * Usage:
 *   npx tsx scripts/compare-schemas.ts
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

if (!TARGET_URL || !TARGET_KEY || !SOURCE_URL || !SOURCE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
  exists: boolean;
}

interface SchemaComparison {
  timestamp: string;
  sourceUrl: string;
  targetUrl: string;
  tables: {
    tableName: string;
    existsInSource: boolean;
    existsInTarget: boolean;
    sourceColumns?: ColumnInfo[];
    targetColumns?: ColumnInfo[];
    differences?: {
      missingInTarget: string[];
      missingInSource: string[];
      typeMismatches: Array<{
        column: string;
        sourceType: string;
        targetType: string;
      }>;
      nullableMismatches: Array<{
        column: string;
        sourceNullable: string;
        targetNullable: string;
      }>;
    };
  }[];
}

async function getTableColumns(
  supabase: any,
  tableName: string
): Promise<ColumnInfo[]> {
  try {
    // Try to get a sample row to infer structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return []; // Table doesn't exist
      }
      throw error;
    }
    
    // If we got data, we can infer column names but not types
    // For a more accurate comparison, we'd need to query information_schema
    // But Supabase doesn't expose that directly, so we'll use a workaround
    
    // Try to get column info by attempting to query specific columns
    // This is a limitation - we'll note it in the report
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      return columns.map(col => ({
        column_name: col,
        data_type: 'unknown', // Can't determine without information_schema
        is_nullable: 'unknown',
        column_default: null
      }));
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

async function checkTableExists(supabase: any, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(0);
    
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return false;
      }
      // Other errors might mean table exists but has RLS issues
      return true;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

async function compareTableSchemas(tableName: string): Promise<SchemaComparison['tables'][0]> {
  console.log(`\n📋 Comparing ${tableName}...`);
  
  const existsInSource = await checkTableExists(sourceSupabase, tableName);
  const existsInTarget = await checkTableExists(targetSupabase, tableName);
  
  console.log(`   Source: ${existsInSource ? '✅ exists' : '❌ missing'}`);
  console.log(`   Target: ${existsInTarget ? '✅ exists' : '❌ missing'}`);
  
  if (!existsInSource && !existsInTarget) {
    return {
      tableName,
      existsInSource: false,
      existsInTarget: false
    };
  }
  
  const sourceColumns = existsInSource ? await getTableColumns(sourceSupabase, tableName) : [];
  const targetColumns = existsInTarget ? await getTableColumns(targetSupabase, tableName) : [];
  
  console.log(`   Source columns: ${sourceColumns.length}`);
  console.log(`   Target columns: ${targetColumns.length}`);
  
  const sourceColumnNames = new Set(sourceColumns.map(c => c.column_name));
  const targetColumnNames = new Set(targetColumns.map(c => c.column_name));
  
  const missingInTarget = sourceColumns
    .filter(c => !targetColumnNames.has(c.column_name))
    .map(c => c.column_name);
  
  const missingInSource = targetColumns
    .filter(c => !sourceColumnNames.has(c.column_name))
    .map(c => c.column_name);
  
  const typeMismatches: Array<{ column: string; sourceType: string; targetType: string }> = [];
  const nullableMismatches: Array<{ column: string; sourceNullable: string; targetNullable: string }> = [];
  
  // Compare columns that exist in both
  sourceColumns.forEach(sourceCol => {
    const targetCol = targetColumns.find(c => c.column_name === sourceCol.column_name);
    if (targetCol) {
      if (sourceCol.data_type !== 'unknown' && targetCol.data_type !== 'unknown' &&
          sourceCol.data_type !== targetCol.data_type) {
        typeMismatches.push({
          column: sourceCol.column_name,
          sourceType: sourceCol.data_type,
          targetType: targetCol.data_type
        });
      }
      
      if (sourceCol.is_nullable !== 'unknown' && targetCol.is_nullable !== 'unknown' &&
          sourceCol.is_nullable !== targetCol.is_nullable) {
        nullableMismatches.push({
          column: sourceCol.column_name,
          sourceNullable: sourceCol.is_nullable,
          targetNullable: targetCol.is_nullable
        });
      }
    }
  });
  
  const differences = {
    missingInTarget,
    missingInSource,
    typeMismatches,
    nullableMismatches
  };
  
  if (missingInTarget.length > 0) {
    console.log(`   ⚠️  Missing in target: ${missingInTarget.join(', ')}`);
  }
  if (missingInSource.length > 0) {
    console.log(`   ⚠️  Missing in source: ${missingInSource.join(', ')}`);
  }
  if (typeMismatches.length > 0) {
    console.log(`   ⚠️  Type mismatches: ${typeMismatches.length}`);
  }
  if (nullableMismatches.length > 0) {
    console.log(`   ⚠️  Nullable mismatches: ${nullableMismatches.length}`);
  }
  
  return {
    tableName,
    existsInSource,
    existsInTarget,
    sourceColumns: sourceColumns.length > 0 ? sourceColumns : undefined,
    targetColumns: targetColumns.length > 0 ? targetColumns : undefined,
    differences: (missingInTarget.length > 0 || missingInSource.length > 0 || 
                  typeMismatches.length > 0 || nullableMismatches.length > 0) ? differences : undefined
  };
}

async function compareSchemas() {
  console.log('🔍 Schema Comparison');
  console.log('===================\n');
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);
  
  const comparison: SchemaComparison = {
    timestamp: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    targetUrl: TARGET_URL,
    tables: []
  };
  
  // Compare primary tables
  const tablesToCompare = [
    'creators_hot',
    'videos_hot',
    'creator_profiles_cold',
    'videos_cold',
    'sounds_hot',
    'sounds_cold',
    'hashtags_hot',
    'hashtags_cold',
    'video_sound_facts',
    'video_hashtag_facts',
    'creator_video_facts'
  ];
  
  for (const tableName of tablesToCompare) {
    const tableComparison = await compareTableSchemas(tableName);
    comparison.tables.push(tableComparison);
  }
  
  // Print summary
  console.log('\n\n📊 Schema Comparison Summary');
  console.log('============================\n');
  
  const tablesWithDifferences = comparison.tables.filter(t => t.differences);
  const tablesMissingInTarget = comparison.tables.filter(t => t.existsInSource && !t.existsInTarget);
  const tablesMissingInSource = comparison.tables.filter(t => !t.existsInSource && t.existsInTarget);
  
  if (tablesMissingInTarget.length > 0) {
    console.log('❌ Tables missing in target:');
    tablesMissingInTarget.forEach(t => {
      console.log(`   - ${t.tableName}`);
    });
  }
  
  if (tablesMissingInSource.length > 0) {
    console.log('\n⚠️  Tables missing in source:');
    tablesMissingInSource.forEach(t => {
      console.log(`   - ${t.tableName}`);
    });
  }
  
  if (tablesWithDifferences.length > 0) {
    console.log('\n⚠️  Tables with schema differences:');
    tablesWithDifferences.forEach(t => {
      console.log(`   - ${t.tableName}:`);
      if (t.differences?.missingInTarget.length) {
        console.log(`     Missing columns in target: ${t.differences.missingInTarget.join(', ')}`);
      }
      if (t.differences?.missingInSource.length) {
        console.log(`     Missing columns in source: ${t.differences.missingInSource.join(', ')}`);
      }
      if (t.differences?.typeMismatches.length) {
        console.log(`     Type mismatches: ${t.differences.typeMismatches.length}`);
      }
    });
  }
  
  if (tablesWithDifferences.length === 0 && tablesMissingInTarget.length === 0) {
    console.log('✅ All schemas align!');
  } else {
    console.log('\n📝 Next steps:');
    if (tablesMissingInTarget.length > 0 || tablesWithDifferences.length > 0) {
      console.log('   1. Review schema differences');
      console.log('   2. Create staging tables if needed (042_source_data_staging_tables.sql)');
      console.log('   3. Run migrate-source-data.ts with appropriate transformations');
    }
  }
  
  // Save report to file
  const reportPath = resolve(process.cwd(), 'schema-comparison-report.json');
  writeFileSync(reportPath, JSON.stringify(comparison, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);
  
  return comparison;
}

compareSchemas().catch(error => {
  console.error('❌ Error during schema comparison:', error);
  process.exit(1);
});

