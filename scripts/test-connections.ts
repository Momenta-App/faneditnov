#!/usr/bin/env tsx

/**
 * Test Connections Script
 * Verifies connections to all three databases before migration
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const MIGRATION_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

async function testConnection(name: string, url: string, key: string) {
  if (!url || !key) {
    console.log(`❌ ${name}: Missing credentials`);
    return false;
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    
    if (error && error.message.includes('relation') === false) {
      console.log(`⚠️  ${name}: ${error.message}`);
      return false;
    }
    
    console.log(`✅ ${name}: Connected successfully`);
    console.log(`   URL: ${url}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Database Connections');
  console.log('==============================\n');

  const results = await Promise.all([
    testConnection('Target Database (PRIMARY)', TARGET_URL || '', TARGET_KEY || ''),
    testConnection('Source Database (SCHEMA)', SOURCE_URL || '', SOURCE_KEY || ''),
    testConnection('Migration Source (DATA)', MIGRATION_URL || '', MIGRATION_KEY || ''),
  ]);

  console.log('\n📊 Results:');
  if (results.every(r => r)) {
    console.log('✅ All connections successful! Ready to proceed with migration.\n');
    return 0;
  } else {
    console.log('❌ Some connections failed. Please check your .env.local file.\n');
    return 1;
  }
}

main().then(code => process.exit(code));

