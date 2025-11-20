#!/usr/bin/env tsx

/**
 * Check which community memberships can be migrated
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
const DATA_SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const DATA_SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY || !DATA_SOURCE_URL || !DATA_SOURCE_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);
const dataSourceSupabase = createClient(DATA_SOURCE_URL, DATA_SOURCE_KEY);

async function checkMemberships() {
  // Get all community IDs from target
  const { data: targetCommunities } = await targetSupabase
    .from('communities')
    .select('id');
  
  const targetCommunityIds = new Set((targetCommunities || []).map((c: any) => c.id));
  console.log(`Target has ${targetCommunityIds.size} communities`);

  // Get all community IDs from source memberships
  const { data: sourceMemberships } = await dataSourceSupabase
    .from('community_video_memberships')
    .select('community_id');
  
  const sourceCommunityIds = new Set((sourceMemberships || []).map((m: any) => m.community_id));
  console.log(`Source memberships reference ${sourceCommunityIds.size} unique communities`);

  // Find missing
  const missing = Array.from(sourceCommunityIds).filter(id => !targetCommunityIds.has(id));
  console.log(`\nMissing communities in target: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`First few: ${missing.slice(0, 5).join(', ')}`);
  }

  // Count memberships we can migrate
  const { data: allMemberships } = await dataSourceSupabase
    .from('community_video_memberships')
    .select('community_id');
  
  const migratable = (allMemberships || []).filter((m: any) => targetCommunityIds.has(m.community_id));
  console.log(`\nMigratable memberships: ${migratable.length} out of ${allMemberships?.length || 0}`);
}

checkMemberships().catch(console.error);

