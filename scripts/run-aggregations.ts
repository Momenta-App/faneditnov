#!/usr/bin/env tsx

/**
 * Run Aggregations Script
 * Updates all aggregation counts after migration
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

if (!TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

async function checkFunctionExists(functionName: string): Promise<boolean> {
  const { data, error } = await targetSupabase.rpc('exec_sql', {
    sql_query: `
      SELECT EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = '${functionName}'
      ) as exists;
    `
  });
  
  // Alternative: try calling the function
  const { error: callError } = await targetSupabase.rpc(functionName);
  return !callError || !callError.message.includes('does not exist');
}

async function runAggregations() {
  console.log('🔄 Running Aggregations');
  console.log('=======================\n');
  
  // Try test_aggregations first (safer)
  console.log('📋 Checking for aggregation functions...');
  
  const { data: testResult, error: testError } = await targetSupabase.rpc('test_aggregations');
  
  if (!testError && testResult) {
    console.log('✅ test_aggregations() executed successfully!');
    console.log('📊 Result:', JSON.stringify(testResult, null, 2));
    return;
  }
  
  // Try update_aggregations directly
  console.log('📋 Trying update_aggregations()...');
  const { data: result, error } = await targetSupabase.rpc('update_aggregations');
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('\n💡 The function may not exist. Try running this SQL in Supabase SQL Editor:');
    console.log('   SELECT update_aggregations();');
    console.log('\n   Or check if the function exists:');
    console.log('   SELECT routine_name FROM information_schema.routines WHERE routine_name = \'update_aggregations\';');
    process.exit(1);
  }
  
  console.log('✅ Aggregations updated successfully!');
  console.log('📊 Result:', JSON.stringify(result, null, 2));
}

runAggregations().catch(console.error);

