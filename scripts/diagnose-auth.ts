import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcrypt';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  console.log('🔍 Diagnosing authentication setup...\n');

  // Check if table exists
  let data, error;
  try {
    const result = await supabase
      .from('simple_users')
      .select('*')
      .eq('email', 'admin@momenta.app');
    data = result.data;
    error = result.error;
  } catch (err: any) {
    error = err;
  }

  if (error) {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    if (errorCode === 'PGRST116' || errorCode === 'PGRST205' || errorMessage.includes('does not exist') || errorMessage.includes('schema cache')) {
      console.error('❌ PROBLEM: Table "simple_users" does not exist!\n');
      console.log('📋 SOLUTION: Run this SQL in Supabase SQL Editor:\n');
      console.log('─'.repeat(80));
      const passwordHash = await bcrypt.hash('Morning-fire444%', 10);
      console.log(`
CREATE TABLE IF NOT EXISTS simple_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simple_users_email ON simple_users(email);

INSERT INTO simple_users (email, password_hash)
VALUES (
  'admin@momenta.app',
  '${passwordHash}'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
`);
      console.log('─'.repeat(80));
      console.log('\n📝 Steps:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Paste the SQL above');
      console.log('3. Click "Run"\n');
      process.exit(1);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  if (!data || data.length === 0) {
    console.error('❌ PROBLEM: Table exists but user not found!\n');
    console.log('📋 SOLUTION: Run this SQL to insert the user:\n');
    console.log('─'.repeat(80));
    const passwordHash = await bcrypt.hash('Morning-fire444%', 10);
    console.log(`
INSERT INTO simple_users (email, password_hash)
VALUES (
  'admin@momenta.app',
  '${passwordHash}'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
`);
    console.log('─'.repeat(80));
    process.exit(1);
  }

  const user = data[0];
  console.log('✅ Table exists');
  console.log('✅ User found:', user.email);
  console.log('   ID:', user.id);
  console.log('   Created:', user.created_at, '\n');

  // Test password
  console.log('Testing password verification...');
  const testPassword = 'Morning-fire444%';
  const isValid = await bcrypt.compare(testPassword, user.password_hash);

  if (isValid) {
    console.log('✅ Password verification: PASSED\n');
    console.log('✅ Everything looks good! You should be able to login.');
    console.log('   Email: admin@momenta.app');
    console.log('   Password: Morning-fire444%\n');
  } else {
    console.log('❌ Password verification: FAILED\n');
    console.log('⚠️  The password hash in the database does not match the expected password.');
    console.log('📋 SOLUTION: Update the password hash by running this SQL:\n');
    console.log('─'.repeat(80));
    const newHash = await bcrypt.hash('Morning-fire444%', 10);
    console.log(`
UPDATE simple_users 
SET password_hash = '${newHash}'
WHERE email = 'admin@momenta.app';
`);
    console.log('─'.repeat(80));
    process.exit(1);
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

