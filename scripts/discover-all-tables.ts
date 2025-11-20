#!/usr/bin/env tsx

/**
 * Table Discovery Script
 * Discovers all tables in all three databases and generates a comprehensive report
 * 
 * Usage:
 *   npx tsx scripts/discover-all-tables.ts
 * 
 * Prerequisites:
 *   - .env.local with all three database credentials
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

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA_SOURCE_URL = process.env.SOURCE_SUPABASE_URL;
const SCHEMA_SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const DATA_SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const DATA_SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables for target database');
  process.exit(1);
}

if (!DATA_SOURCE_URL || !DATA_SOURCE_KEY) {
  console.error('❌ Missing required environment variables for data source database');
  process.exit(1);
}

// Schema source is optional
const hasSchemaSource = SCHEMA_SOURCE_URL && SCHEMA_SOURCE_KEY;

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const schemaSourceSupabase = hasSchemaSource ? createClient(SCHEMA_SOURCE_URL!, SCHEMA_SOURCE_KEY!) : null;
const dataSourceSupabase = createClient(DATA_SOURCE_URL, DATA_SOURCE_KEY);

interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
}

interface DatabaseTables {
  database: string;
  url: string;
  tables: string[];
  error?: string;
}

// System schemas to exclude
const EXCLUDED_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1'];
// System tables to exclude (even if in public schema)
const EXCLUDED_TABLES = ['schema_migrations', 'supabase_migrations'];

async function discoverTables(supabase: any, dbName: string, dbUrl: string): Promise<DatabaseTables> {
  const result: DatabaseTables = {
    database: dbName,
    url: dbUrl,
    tables: [],
  };

  try {
    // Query information_schema.tables using RPC or direct SQL
    // Since Supabase doesn't expose information_schema directly, we'll use a workaround
    // Try to query tables using a SQL function or list tables by attempting to query them
    
    // Alternative approach: Use Supabase's REST API to list tables
    // We'll query a known system table that should exist to test connection
    const { data: testData, error: testError } = await supabase
      .from('videos_hot')
      .select('*', { count: 'exact', head: true })
      .limit(0);

    if (testError && !testError.message.includes('relation') && !testError.message.includes('does not exist')) {
      // Connection issue
      result.error = `Connection error: ${testError.message}`;
      return result;
    }

    // Since we can't directly query information_schema via Supabase client,
    // we'll use a list of known tables and check which ones exist
    // For a more comprehensive approach, we could use a SQL query via RPC
    
    // Known tables from the schema files
    const knownTables = [
      // Core Hot Tables
      'creators_hot',
      'videos_hot',
      'sounds_hot',
      'hashtags_hot',
      // Core Cold Tables
      'creators_cold',
      'creator_profiles_cold',
      'videos_cold',
      'sounds_cold',
      'hashtags_cold',
      // Fact/Relationship Tables
      'video_sound_facts',
      'video_hashtag_facts',
      'creator_video_facts',
      'raw_refs',
      'video_creator_mentions',
      // Communities Tables
      'communities',
      'community_video_memberships',
      'community_creator_memberships',
      'community_hashtag_memberships',
      // Time Series Tables
      'video_metrics_timeseries',
      'creator_metrics_timeseries',
      'sound_metrics_timeseries',
      'hashtag_metrics_timeseries',
      'video_play_count_history',
      // Leaderboard Views (we'll check these too)
      'leaderboards_creators',
      'leaderboards_videos',
      'leaderboards_sounds',
      'leaderboards_hashtags',
      // Other Tables
      'rejected_videos',
      'submission_metadata',
      'bd_ingestions',
      'profiles',
      'user_daily_quotas',
      'hashtag_daily_stats',
      'creator_daily_stats',
      'sound_daily_stats',
      'community_daily_stats',
      'homepage_cache',
      'creator_contacts',
      'brand_contact_submissions',
      'auth_rate_limits',
    ];

    // Check each table
    for (const tableName of knownTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .limit(0);
        
        if (!error || error.code === 'PGRST116') {
          // Table exists (PGRST116 is "no rows returned" which is fine)
          result.tables.push(tableName);
        }
      } catch (err) {
        // Table doesn't exist or error accessing it
        // Skip silently
      }
    }

    // Also try to discover additional tables using a SQL query if possible
    // We'll use a custom RPC function approach or direct SQL
    try {
      // Try to get all tables from information_schema using a custom query
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT IN (${EXCLUDED_TABLES.map(t => `'${t}'`).join(', ')})
          ORDER BY table_name;
        `
      });

      if (!sqlError && sqlData) {
        // If RPC works, use those results
        const discoveredTables = sqlData.map((row: any) => row.table_name);
        // Merge with known tables, avoiding duplicates
        const allTables = new Set([...result.tables, ...discoveredTables]);
        result.tables = Array.from(allTables).sort();
      }
    } catch (err) {
      // RPC might not be available, that's okay - we'll use the known tables list
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

async function discoverAllTables() {
  console.log('🔍 Discovering Tables in All Databases');
  console.log('======================================\n');

  const results: {
    target: DatabaseTables;
    schemaSource: DatabaseTables;
    dataSource: DatabaseTables;
    allTables: string[];
  } = {
    target: { database: 'Target', url: TARGET_URL || '', tables: [] },
    schemaSource: { database: 'Schema Source', url: SCHEMA_SOURCE_URL || '', tables: [] },
    dataSource: { database: 'Data Source', url: DATA_SOURCE_URL || '', tables: [] },
    allTables: [],
  };

  // Discover tables in each database
  console.log('📋 Discovering tables in Target database...');
  results.target = await discoverTables(targetSupabase, 'Target', TARGET_URL || '');
  if (results.target.error) {
    console.log(`   ⚠️  ${results.target.error}`);
  } else {
    console.log(`   ✅ Found ${results.target.tables.length} tables`);
  }

  if (hasSchemaSource) {
    console.log('\n📋 Discovering tables in Schema Source database...');
    results.schemaSource = await discoverTables(schemaSourceSupabase!, 'Schema Source', SCHEMA_SOURCE_URL || '');
    if (results.schemaSource.error) {
      console.log(`   ⚠️  ${results.schemaSource.error}`);
    } else {
      console.log(`   ✅ Found ${results.schemaSource.tables.length} tables`);
    }
  } else {
    console.log('\n⏭️  Skipping Schema Source database (not configured)');
    results.schemaSource = { database: 'Schema Source', url: '', tables: [] };
  }

  console.log('\n📋 Discovering tables in Data Source database...');
  results.dataSource = await discoverTables(dataSourceSupabase, 'Data Source', DATA_SOURCE_URL || '');
  if (results.dataSource.error) {
    console.log(`   ⚠️  ${results.dataSource.error}`);
  } else {
    console.log(`   ✅ Found ${results.dataSource.tables.length} tables`);
  }

  // Create master list of all unique tables
  const allTablesSet = new Set<string>();
  results.target.tables.forEach(t => allTablesSet.add(t));
  results.schemaSource.tables.forEach(t => allTablesSet.add(t));
  results.dataSource.tables.forEach(t => allTablesSet.add(t));
  results.allTables = Array.from(allTablesSet).sort();

  console.log(`\n📊 Summary`);
  console.log(`   Total unique tables found: ${results.allTables.length}`);
  console.log(`   Target database: ${results.target.tables.length} tables`);
  console.log(`   Schema Source: ${results.schemaSource.tables.length} tables`);
  console.log(`   Data Source: ${results.dataSource.tables.length} tables`);

  // Save results to JSON file
  const outputPath = resolve(process.cwd(), 'table-discovery-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // Print table comparison
  console.log('\n📋 Table Comparison:');
  console.log('   Tables in Target only:', results.target.tables.filter(t => 
    !results.schemaSource.tables.includes(t) && !results.dataSource.tables.includes(t)
  ).length);
  console.log('   Tables in Schema Source only:', results.schemaSource.tables.filter(t => 
    !results.target.tables.includes(t) && !results.dataSource.tables.includes(t)
  ).length);
  console.log('   Tables in Data Source only:', results.dataSource.tables.filter(t => 
    !results.target.tables.includes(t) && !results.schemaSource.tables.includes(t)
  ).length);
  console.log('   Tables in all three:', results.allTables.filter(t => 
    results.target.tables.includes(t) && 
    results.schemaSource.tables.includes(t) && 
    results.dataSource.tables.includes(t)
  ).length);

  return results;
}

discoverAllTables().catch(console.error);

