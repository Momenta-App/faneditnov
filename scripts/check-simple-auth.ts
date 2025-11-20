import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSimpleAuth() {
  console.log('Checking simple_users table...\n');

  // Check if table exists
  const { data: users, error } = await supabase
    .from('simple_users')
    .select('*');

  if (error) {
    console.error('❌ Error querying simple_users table:', error.message);
    console.error('   This likely means the table does not exist.');
    console.error('   Please run the SQL migration: sql/039_simple_auth_users.sql\n');
    return;
  }

  if (!users || users.length === 0) {
    console.error('❌ No users found in simple_users table');
    console.error('   Please run the SQL migration: sql/039_simple_auth_users.sql\n');
    return;
  }

  console.log(`✅ Found ${users.length} user(s) in simple_users table:\n`);

  for (const user of users) {
    console.log(`Email: ${user.email}`);
    console.log(`ID: ${user.id}`);
    console.log(`Password hash: ${user.password_hash.substring(0, 20)}...`);

    // Test password verification
    const testPassword = 'Morning-fire444%';
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`Password verification test: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
  }
}

checkSimpleAuth()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

