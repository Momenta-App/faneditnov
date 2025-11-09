#!/usr/bin/env tsx

/**
 * Test database connection and list tables
 */

import { createClient } from '@supabase/supabase-js';

async function testConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test connection
    console.log('🔌 Testing connection...');
    const { data, error } = await supabase.from('tiktok_posts').select('count').limit(1);

    if (error) {
      console.error('❌ Connection failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Connection successful!\n');

    // List hot tables
    console.log('📋 Checking hot tables...');
    const { data: tables } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT table_name FROM information_schema.tables 
                  WHERE table_schema = 'public' AND table_name LIKE '%hot%' 
                  ORDER BY table_name;`
    });

    if (tables && tables.length > 0) {
      console.log('   Hot tables found:');
      tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
    } else {
      console.log('   No hot tables found yet');
    }

    console.log('\n📊 Database status: Ready');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

testConnection();

