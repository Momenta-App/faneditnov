#!/usr/bin/env tsx

/**
 * Database Wipe Script
 * Safely wipes all user tables, functions, views, and triggers from target database
 * Preserves Supabase system tables (auth, storage, etc.)
 * 
 * Usage:
 *   npx tsx scripts/wipe-database.ts
 * 
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (target database)
 * 
 * WARNING: This will DELETE ALL DATA in the target database!
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

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', TARGET_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', TARGET_KEY ? '✅' : '❌');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

// Supabase system schemas to preserve
const PRESERVED_SCHEMAS = ['auth', 'storage', 'extensions', 'pg_catalog', 'information_schema', 'pg_toast'];

async function executeSQL(sql: string): Promise<any> {
  // Try using RPC if available
  const { data, error } = await targetSupabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // If RPC doesn't exist, we'll need to use direct REST API or psql
    // For now, return the error and let the caller handle it
    throw new Error(`SQL execution failed: ${error.message}`);
  }
  
  return data;
}

async function getTables(): Promise<string[]> {
  const sql = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  try {
    const { data, error } = await targetSupabase.rpc('exec_sql', { sql_query: sql });
    if (error) throw error;
    
    // If exec_sql returns results directly
    if (Array.isArray(data)) {
      return data.map((row: any) => row.table_name || row[0]).filter(Boolean);
    }
    
    // Otherwise, query via REST API
    const { data: tables, error: queryError } = await targetSupabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (queryError) {
      console.log('⚠️  Could not query tables via REST API');
      console.log('   Will use direct SQL approach...\n');
      return [];
    }
    
    return (tables || []).map((t: any) => t.table_name);
  } catch (error) {
    console.log('⚠️  Error querying tables, will proceed with direct SQL...\n');
    return [];
  }
}

async function getFunctions(): Promise<string[]> {
  const sql = `
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
    ORDER BY routine_name;
  `;
  
  try {
    const { data, error } = await targetSupabase.rpc('exec_sql', { sql_query: sql });
    if (error) throw error;
    
    if (Array.isArray(data)) {
      return data.map((row: any) => row.routine_name || row[0]).filter(Boolean);
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

async function getViews(): Promise<string[]> {
  const sql = `
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  
  try {
    const { data, error } = await targetSupabase.rpc('exec_sql', { sql_query: sql });
    if (error) throw error;
    
    if (Array.isArray(data)) {
      return data.map((row: any) => row.table_name || row[0]).filter(Boolean);
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

async function wipeDatabase() {
  console.log('🗑️  Database Wipe Script');
  console.log('========================\n');
  console.log(`Target URL: ${TARGET_URL}\n`);
  console.log('⚠️  WARNING: This will DELETE ALL DATA in the target database!');
  console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('🚀 Proceeding with wipe...\n');
  
  try {
    // Step 1: Drop all views first (they depend on tables)
    console.log('📋 Step 1: Dropping views...');
    const views = await getViews();
    if (views.length > 0) {
      for (const view of views) {
        try {
          const sql = `DROP VIEW IF EXISTS public.${view} CASCADE;`;
          await executeSQL(sql);
          console.log(`   ✅ Dropped view: ${view}`);
        } catch (error) {
          console.log(`   ⚠️  Could not drop view ${view}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } else {
      console.log('   ℹ️  No views found');
    }
    
    // Step 2: Drop all functions
    console.log('\n📋 Step 2: Dropping functions...');
    const functions = await getFunctions();
    if (functions.length > 0) {
      for (const func of functions) {
        try {
          // Get function signature to drop it properly
          const dropSQL = `DROP FUNCTION IF EXISTS public.${func} CASCADE;`;
          await executeSQL(dropSQL);
          console.log(`   ✅ Dropped function: ${func}`);
        } catch (error) {
          console.log(`   ⚠️  Could not drop function ${func}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } else {
      console.log('   ℹ️  No functions found');
    }
    
    // Step 3: Drop all tables (CASCADE will handle dependencies)
    console.log('\n📋 Step 3: Dropping tables...');
    const tables = await getTables();
    
    if (tables.length > 0) {
      // Drop tables in reverse dependency order
      // Start with tables that likely have foreign keys
      const dropOrder = [
        // Fact/relationship tables first
        'video_hashtag_facts',
        'video_sound_facts',
        'community_video_memberships',
        'community_creator_memberships',
        'community_hashtag_memberships',
        // History/tracking tables
        'video_play_count_history',
        'bd_ingestions',
        // Main tables
        'videos_hot',
        'videos_cold',
        'creators_hot',
        'creator_profiles_cold',
        'creators_cold',
        'sounds_hot',
        'sounds_cold',
        'hashtags_hot',
        'hashtags_cold',
        'communities',
        'rejected_videos',
        'submission_metadata',
        'profiles',
        // Other tables
      ];
      
      // Drop known tables first, then any remaining
      const knownDropped = new Set<string>();
      for (const table of dropOrder) {
        if (tables.includes(table)) {
          try {
            const sql = `DROP TABLE IF EXISTS public.${table} CASCADE;`;
            await executeSQL(sql);
            console.log(`   ✅ Dropped table: ${table}`);
            knownDropped.add(table);
          } catch (error) {
            console.log(`   ⚠️  Could not drop table ${table}: ${error instanceof Error ? error.message : error}`);
          }
        }
      }
      
      // Drop any remaining tables
      for (const table of tables) {
        if (!knownDropped.has(table)) {
          try {
            const sql = `DROP TABLE IF EXISTS public.${table} CASCADE;`;
            await executeSQL(sql);
            console.log(`   ✅ Dropped table: ${table}`);
          } catch (error) {
            console.log(`   ⚠️  Could not drop table ${table}: ${error instanceof Error ? error.message : error}`);
          }
        }
      }
    } else {
      console.log('   ℹ️  No tables found (or could not query)');
      console.log('   Will attempt direct DROP CASCADE...');
      
      // Fallback: Drop all tables in public schema using CASCADE
      const dropAllSQL = `
        DO $$ 
        DECLARE 
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
          LOOP
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `;
      
      try {
        await executeSQL(dropAllSQL);
        console.log('   ✅ Dropped all tables using CASCADE');
      } catch (error) {
        console.log(`   ⚠️  Error: ${error instanceof Error ? error.message : error}`);
        console.log('   You may need to run this manually in Supabase SQL Editor');
      }
    }
    
    // Step 4: Drop all sequences
    console.log('\n📋 Step 4: Dropping sequences...');
    const dropSequencesSQL = `
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') 
        LOOP
          EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    
    try {
      await executeSQL(dropSequencesSQL);
      console.log('   ✅ Dropped all sequences');
    } catch (error) {
      console.log(`   ⚠️  Error dropping sequences: ${error instanceof Error ? error.message : error}`);
    }
    
    // Step 5: Drop all types
    console.log('\n📋 Step 5: Dropping custom types...');
    const dropTypesSQL = `
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'c') 
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    
    try {
      await executeSQL(dropTypesSQL);
      console.log('   ✅ Dropped all custom types');
    } catch (error) {
      console.log(`   ⚠️  Error dropping types: ${error instanceof Error ? error.message : error}`);
    }
    
    console.log('\n✅ Database wipe complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify all tables are dropped (check Supabase Dashboard)');
    console.log('   2. Run scripts/apply-schema.ts to apply the new schema');
    
  } catch (error) {
    console.error('\n❌ Error during wipe:', error instanceof Error ? error.message : error);
    console.error('\n💡 If automatic wipe failed, you can run this SQL manually in Supabase SQL Editor:');
    console.error(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        -- Drop all views
        FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') 
        LOOP
          EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
        END LOOP;
        
        -- Drop all tables
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
        
        -- Drop all functions
        FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') 
        LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    process.exit(1);
  }
}

wipeDatabase().catch(console.error);

