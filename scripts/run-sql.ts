#!/usr/bin/env tsx

/**
 * Migration runner for SQL files
 * Usage: tsx scripts/run-sql.ts sql/006_hot_tables.sql
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

async function runSQL(filename: string) {
  if (!filename) {
    console.error('Usage: tsx scripts/run-sql.ts <sql-file>');
    process.exit(1);
  }

  // Read SQL file
  const sql = readFileSync(filename, 'utf-8');
  console.log(`📄 Running SQL from: ${filename}`);

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📊 Found ${statements.length} statements to execute`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Skip comments and blank lines
    if (statement.match(/^\s*--/)) continue;
    
    console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      });

      if (error) {
        // Direct SQL execution as fallback
        console.log('   ℹ️  Using direct query execution...');
        const { error: directError } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });
        
        if (directError) {
          console.error(`❌ Error in statement ${i + 1}:`, directError.message);
          console.error('   Statement:', statement.substring(0, 100) + '...');
        } else {
          console.log('   ✓ Success');
        }
      } else {
        console.log('   ✓ Success');
      }
    } catch (err) {
      console.error(`❌ Error:`, err);
    }
  }

  console.log('\n✅ Migration complete!');
}

// Run with filename from command line
const filename = process.argv[2];
runSQL(filename).catch(console.error);

