#!/usr/bin/env tsx

/**
 * Schema Export Script
 * Exports the complete database schema from the source database
 * 
 * Usage:
 *   npx tsx scripts/export-schema.ts
 * 
 * Prerequisites:
 *   - .env.local with SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY
 */

import { writeFileSync, existsSync } from 'fs';
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

const SOURCE_URL = process.env.SOURCE_SUPABASE_URL ?? '';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SOURCE_SUPABASE_URL:', SOURCE_URL ? '✅' : '❌');
  console.error('   SOURCE_SUPABASE_SERVICE_ROLE_KEY:', SOURCE_KEY ? '✅' : '❌');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

async function exportSchema() {
  console.log('📤 Exporting Schema from Source Database');
  console.log('==========================================\n');
  console.log(`Source URL: ${SOURCE_URL}\n`);

  const schemaParts: string[] = [];
  
  // Extract database connection details from URL
  const urlMatch = SOURCE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    throw new Error('Invalid Supabase URL format');
  }
  const projectRef = urlMatch[1];
  
  // Get database password from service role key (we'll need to use pg_dump)
  // For Supabase, we need to use the direct database connection
  // Extract connection string from Supabase URL
  const dbHost = `db.${projectRef}.supabase.co`;
  const dbPort = '5432';
  const dbName = 'postgres';
  const dbUser = 'postgres';
  
  // Note: We'll need the database password, which is typically found in Supabase dashboard
  // For now, we'll use the Supabase REST API to query schema information
  
  console.log('📋 Querying schema information...\n');
  
  try {
    // Get all tables
    const { data: tables, error: tablesError } = await sourceSupabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (tablesError) {
      console.log('⚠️  Could not query tables via REST API, will use SQL queries instead...\n');
    } else {
      console.log(`Found ${tables?.length || 0} tables in public schema`);
    }
    
    // Use SQL to get schema information
    const schemaQueries = [
      // Get table definitions
      `SELECT 
        'CREATE TABLE IF NOT EXISTS ' || quote_ident(table_name) || ' (' || 
        string_agg(
          quote_ident(column_name) || ' ' || 
          CASE 
            WHEN data_type = 'ARRAY' THEN udt_name || '[]'
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            ELSE data_type
          END ||
          CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default
            ELSE ''
          END,
          ', '
          ORDER BY ordinal_position
        ) || ');' as create_statement
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      ORDER BY table_name;`,
      
      // Get indexes
      `SELECT 
        'CREATE INDEX IF NOT EXISTS ' || indexname || ' ON ' || 
        tablename || ' (' || indexdef || ');' as create_statement
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;`,
      
      // Get functions
      `SELECT 
        'CREATE OR REPLACE FUNCTION ' || routine_name || 
        '(' || COALESCE(parameter_list, '') || ') ' ||
        'RETURNS ' || return_type || ' AS $$ ' ||
        routine_definition || ' $$ LANGUAGE ' || routine_language || ';' as create_statement
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;`,
    ];
    
    // Since we can't easily execute complex queries via REST API,
    // we'll create a comprehensive SQL script that can be run manually
    // or we'll use pg_dump if available
    
    console.log('📝 Generating schema export SQL...\n');
    
    // Create a SQL script that exports the schema
    const exportSQL = `-- Schema Export from Source Database
-- Generated: ${new Date().toISOString()}
-- Source: ${SOURCE_URL}

-- This script exports the complete schema from the source database.
-- Run this in the source database's SQL Editor to get the schema.

-- ============================================================================
-- EXPORT ALL TABLES
-- ============================================================================

SELECT 
  'CREATE TABLE IF NOT EXISTS ' || quote_ident(t.table_name) || ' (' || 
  string_agg(
    quote_ident(c.column_name) || ' ' || 
    CASE 
      WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
      WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
      ELSE c.data_type
    END ||
    CASE WHEN c.character_maximum_length IS NOT NULL 
      THEN '(' || c.character_maximum_length || ')'
      ELSE ''
    END ||
    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN c.column_default IS NOT NULL 
      THEN ' DEFAULT ' || c.column_default
      ELSE ''
    END,
    ', '
    ORDER BY c.ordinal_position
  ) || ');' as create_statement
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================================================
-- EXPORT ALL INDEXES
-- ============================================================================

SELECT 
  indexdef || ';' as create_statement
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- EXPORT ALL FUNCTIONS
-- ============================================================================

SELECT 
  pg_get_functiondef(oid) || ';' as create_statement
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ============================================================================
-- EXPORT ALL TRIGGERS
-- ============================================================================

SELECT 
  'CREATE TRIGGER ' || quote_ident(trigger_name) || 
  ' ' || action_timing || ' ' || event_manipulation ||
  ' ON ' || quote_ident(event_object_table) ||
  ' FOR EACH ROW EXECUTE FUNCTION ' || action_statement || ';' as create_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- EXPORT ALL VIEWS
-- ============================================================================

SELECT 
  'CREATE OR REPLACE VIEW ' || quote_ident(table_name) || ' AS ' ||
  view_definition || ';' as create_statement
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- EXPORT RLS POLICIES
-- ============================================================================

SELECT 
  'ALTER TABLE ' || quote_ident(schemaname) || '.' || quote_ident(tablename) ||
  ' ENABLE ROW LEVEL SECURITY;' as create_statement
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;

SELECT 
  'CREATE POLICY ' || quote_ident(policyname) || 
  ' ON ' || quote_ident(schemaname) || '.' || quote_ident(tablename) ||
  ' FOR ' || cmd ||
  ' USING (' || qual || ')' ||
  CASE WHEN with_check IS NOT NULL 
    THEN ' WITH CHECK (' || with_check || ')'
    ELSE ''
  END || ';' as create_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
`;

    const outputPath = resolve(process.cwd(), 'sql', 'exported_schema_from_source.sql');
    writeFileSync(outputPath, exportSQL, 'utf-8');
    
    console.log('✅ Schema export SQL script created!');
    console.log(`📁 Location: ${outputPath}\n`);
    console.log('⚠️  IMPORTANT:');
    console.log('   1. Go to your SOURCE database SQL Editor (https://hflcevjepybupsxsqrqg.supabase.co)');
    console.log('   2. Run the queries in the exported SQL file');
    console.log('   3. Copy the results and save them as the actual schema SQL');
    console.log('   4. OR use pg_dump if you have direct database access:\n');
    console.log(`   pg_dump -h db.hflcevjepybupsxsqrqg.supabase.co -U postgres -d postgres --schema-only > sql/exported_schema_from_source.sql\n`);
    
    // Alternative: Try to use Supabase Management API or direct SQL execution
    console.log('\n📋 Attempting to query schema via Supabase API...\n');
    
    // Try to get a list of tables using a simple query
    const { data: tableList, error: tableListError } = await sourceSupabase.rpc('exec_sql', {
      sql_query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`
    });
    
    if (!tableListError && tableList) {
      console.log('✅ Successfully queried tables:');
      console.log(JSON.stringify(tableList, null, 2));
    } else {
      console.log('⚠️  Direct SQL execution not available via API');
      console.log('   You will need to use pg_dump or run queries manually in SQL Editor\n');
    }
    
  } catch (error) {
    console.error('❌ Error exporting schema:', error instanceof Error ? error.message : error);
    console.error('\n💡 Alternative: Use pg_dump directly:');
    console.error(`   pg_dump -h db.${projectRef}.supabase.co -U postgres -d postgres --schema-only -f sql/exported_schema_from_source.sql`);
    process.exit(1);
  }
}

exportSchema().catch(console.error);

