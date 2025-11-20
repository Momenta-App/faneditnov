import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTable() {
  console.log('🔐 Creating simple_users table...\n');

  // Generate password hash
  const password = 'Morning-fire444%';
  console.log('Generating password hash...');
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('✅ Hash generated\n');

  // Try to create table using SQL function
  // First, let's try to execute raw SQL via a function call
  // If that doesn't work, we'll provide the SQL to run manually

  console.log('Attempting to create table via Supabase...\n');

  // Since we can't easily execute DDL via the JS client,
  // we'll provide clear instructions and the exact SQL to run
  console.log('⚠️  Supabase JS client cannot create tables directly.');
  console.log('   You need to run the SQL in Supabase SQL Editor.\n');
  console.log('📋 Copy and paste this SQL into Supabase SQL Editor:\n');
  console.log('─'.repeat(80));
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
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Click on "SQL Editor" in the left sidebar');
  console.log('3. Click "New query"');
  console.log('4. Paste the SQL above');
  console.log('5. Click "Run" (or press Cmd/Ctrl + Enter)');
  console.log('\n✅ After running the SQL, try logging in again!\n');
}

createTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

