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
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupSimpleAuth() {
  console.log('🔐 Setting up simple authentication...\n');

  // Generate password hash
  const password = 'Morning-fire444%';
  console.log('Generating password hash for: Morning-fire444%');
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('✅ Password hash generated\n');

  // Check if table exists by trying to query it
  const { error: checkError } = await supabase
    .from('simple_users')
    .select('id')
    .limit(1);

  if (checkError) {
    if (checkError.code === 'PGRST116' || checkError.message?.includes('does not exist')) {
      console.error('❌ Table "simple_users" does not exist!\n');
      console.error('Please run the SQL migration in Supabase SQL Editor:\n');
      console.error('1. Go to your Supabase Dashboard');
      console.error('2. Navigate to SQL Editor');
      console.error('3. Copy and paste the contents of: sql/039_simple_auth_users.sql');
      console.error('4. Replace the password hash with this one:');
      console.error(`   ${passwordHash}\n`);
      console.error('Or use this complete SQL:\n');
      console.log('-- Copy and paste this into Supabase SQL Editor --\n');
      console.log(`CREATE TABLE IF NOT EXISTS simple_users (
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
ON CONFLICT (email) DO NOTHING;\n`);
      process.exit(1);
    } else {
      throw checkError;
    }
  }

  // Table exists, check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('simple_users')
    .select('*')
    .eq('email', 'admin@momenta.app')
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existingUser) {
    console.log('✅ User already exists, updating password hash...');
    const { error: updateError } = await supabase
      .from('simple_users')
      .update({ password_hash: passwordHash })
      .eq('email', 'admin@momenta.app');

    if (updateError) {
      throw updateError;
    }
    console.log('✅ Password hash updated\n');
  } else {
    console.log('Inserting user...');
    const { data: newUser, error: insertError } = await supabase
      .from('simple_users')
      .insert({
        email: 'admin@momenta.app',
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log('✅ User inserted successfully\n');
  }

  // Verify setup
  console.log('Verifying setup...');
  const { data: users, error: verifyError } = await supabase
    .from('simple_users')
    .select('*')
    .eq('email', 'admin@momenta.app')
    .single();

  if (verifyError) {
    throw verifyError;
  }

  if (!users) {
    throw new Error('User not found after setup');
  }

  console.log('✅ Setup verified!');
  console.log(`   Email: ${users.email}`);
  console.log(`   ID: ${users.id}\n`);

  // Test password
  console.log('Testing password verification...');
  const isValid = await bcrypt.compare('Morning-fire444%', users.password_hash);
  if (isValid) {
    console.log('   ✅ Password verification test PASSED\n');
  } else {
    console.log('   ❌ Password verification test FAILED');
    console.log('   This indicates the password hash is incorrect.\n');
    process.exit(1);
  }

  console.log('✅ Simple auth setup complete!');
  console.log('   You can now login with:');
  console.log('   Email: admin@momenta.app');
  console.log('   Password: Morning-fire444%\n');
}

setupSimpleAuth()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message || error);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  });
