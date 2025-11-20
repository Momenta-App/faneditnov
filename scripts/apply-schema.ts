#!/usr/bin/env tsx

/**
 * Schema Application Script
 * Applies the exported schema to the target database
 * 
 * Usage:
 *   npx tsx scripts/apply-schema.ts [schema-file]
 * 
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (target database)
 *   - sql/exported_schema_from_source.sql (or specify custom file)
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

async function executeSQL(sql: string): Promise<any> {
  // Try using RPC if available
  const { data, error } = await targetSupabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // If RPC doesn't exist, we'll need to handle it differently
    throw new Error(`SQL execution failed: ${error.message}`);
  }
  
  return data;
}

async function applySchema(schemaFile: string) {
  console.log('📥 Applying Schema to Target Database');
  console.log('=====================================\n');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Schema File: ${schemaFile}\n`);
  
  if (!existsSync(schemaFile)) {
    console.error(`❌ Schema file not found: ${schemaFile}`);
    console.error('\n💡 Options:');
    console.error('   1. Run scripts/export-schema.ts first to generate the schema');
    console.error('   2. Use the existing SQL migration files in sql/ directory');
    console.error('   3. Specify a custom schema file path');
    process.exit(1);
  }
  
  const schemaSQL = readFileSync(schemaFile, 'utf-8');
  
  if (!schemaSQL || schemaSQL.trim().length === 0) {
    console.error('❌ Schema file is empty');
    process.exit(1);
  }
  
  console.log('📋 Schema file loaded successfully');
  console.log(`   Size: ${(schemaSQL.length / 1024).toFixed(2)} KB\n`);
  
  // Check if we should use the existing migration files instead
  const useMigrations = !schemaFile.includes('exported_schema_from_source');
  
  if (useMigrations) {
    console.log('⚠️  Note: If the exported schema is not available,');
    console.log('   you can use the existing migration files instead.\n');
    console.log('   Run: npx tsx scripts/setup-database.ts\n');
  }
  
  try {
    // Split SQL into statements
    // This is tricky because functions and triggers contain semicolons
    // We'll try to execute the entire file first, then fall back to statement-by-statement
    
    console.log('🚀 Applying schema...\n');
    
    // Try executing the entire SQL file
    try {
      await executeSQL(schemaSQL);
      console.log('✅ Schema applied successfully!\n');
    } catch (error) {
      console.log('⚠️  Could not execute as single statement, trying statement-by-statement...\n');
      
      // Fall back to statement-by-statement execution
      // This is a simplified approach - for complex SQL with functions,
      // manual execution in SQL Editor may be needed
      const statements = schemaSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`📊 Found ${statements.length} statements to execute\n`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        
        // Skip comments
        if (statement.match(/^\s*--/)) continue;
        
        try {
          await executeSQL(statement);
          successCount++;
          if ((i + 1) % 10 === 0) {
            console.log(`   Progress: ${i + 1}/${statements.length} statements`);
          }
        } catch (error) {
          errorCount++;
          console.log(`   ⚠️  Error in statement ${i + 1}: ${error instanceof Error ? error.message : error}`);
          console.log(`   Statement preview: ${statement.substring(0, 100)}...`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\n📊 Results: ${successCount} successful, ${errorCount} errors`);
      
      if (errorCount > 0) {
        console.log('\n⚠️  Some statements failed. You may need to:');
        console.log('   1. Review the errors above');
        console.log('   2. Run the schema manually in Supabase SQL Editor');
        console.log('   3. Or use the existing migration files: npx tsx scripts/setup-database.ts');
      }
    }
    
    // Verify schema application
    console.log('\n📋 Verifying schema application...\n');
    
    const { data: tables, error: tablesError } = await targetSupabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (!tablesError && tables) {
      console.log(`✅ Found ${tables.length} tables in public schema:`);
      const tableNames = (tables as any[]).map(t => t.table_name).sort();
      tableNames.forEach(name => console.log(`   - ${name}`));
    } else {
      console.log('⚠️  Could not verify tables (this is okay if RPC is not available)');
    }
    
    console.log('\n✅ Schema application complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify tables in Supabase Dashboard');
    console.log('   2. Run scripts/migrate-tiktok-data.ts to populate data');
    
  } catch (error) {
    console.error('\n❌ Error applying schema:', error instanceof Error ? error.message : error);
    console.error('\n💡 Alternative: Use the existing migration files:');
    console.error('   npx tsx scripts/setup-database.ts');
    console.error('\n   Or run the SQL manually in Supabase SQL Editor');
    process.exit(1);
  }
}

// Get schema file from command line or use default
const schemaFile = process.argv[2] || resolve(process.cwd(), 'sql', 'exported_schema_from_source.sql');

applySchema(schemaFile).catch(console.error);

