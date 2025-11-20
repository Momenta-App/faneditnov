#!/usr/bin/env tsx

/**
 * Backfill Missing Data Script
 * Fills gaps in migrated data and updates aggregate counts
 * 
 * Usage:
 *   npx tsx scripts/backfill-missing-data.ts
 * 
 * Prerequisites:
 *   - .env.local with SUPABASE_SERVICE_ROLE_KEY
 *   - Run migrate-source-data.ts first
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
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
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

interface BackfillStats {
  creatorsCreated: number;
  videosCreated: number;
  creatorCountsUpdated: number;
  videoCountsUpdated: number;
  errors: number;
}

async function backfillMissingCreators(): Promise<number> {
  console.log('\n📦 Backfilling Missing Creators...');
  
  let created = 0;
  
  try {
    // Find videos with creator_ids that don't exist in creators_hot
    const { data: videosWithMissingCreators, error } = await targetSupabase
      .rpc('exec_sql', {
        query: `
          SELECT DISTINCT v.creator_id
          FROM videos_hot v
          LEFT JOIN creators_hot c ON v.creator_id = c.creator_id
          WHERE c.creator_id IS NULL
          LIMIT 1000;
        `
      }).catch(() => {
        // If RPC doesn't work, use a different approach
        return { data: null, error: { message: 'RPC not available' } };
      });
    
    if (error || !videosWithMissingCreators) {
      // Alternative approach: Get all unique creator_ids from videos
      const { data: videos } = await targetSupabase
        .from('videos_hot')
        .select('creator_id')
        .limit(10000);
      
      if (!videos) return 0;
      
      const uniqueCreatorIds = [...new Set(videos.map(v => v.creator_id))];
      
      // Check which creators exist
      for (const creatorId of uniqueCreatorIds) {
        const { data: existing } = await targetSupabase
          .from('creators_hot')
          .select('creator_id')
          .eq('creator_id', creatorId)
          .limit(1)
          .single();
        
        if (!existing) {
          // Create minimal creator record
          const { error: insertError } = await targetSupabase
            .from('creators_hot')
            .insert({
              creator_id: creatorId,
              username: creatorId || 'unknown',
              first_seen_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (!insertError) {
            created++;
            if (created % 10 === 0) {
              console.log(`   ✅ Created ${created} missing creators`);
            }
          }
        }
      }
    } else {
      // Use RPC results
      for (const row of videosWithMissingCreators as any[]) {
        const creatorId = row.creator_id;
        const { error: insertError } = await targetSupabase
          .from('creators_hot')
          .insert({
            creator_id: creatorId,
            username: creatorId || 'unknown',
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (!insertError) {
          created++;
        }
      }
    }
    
    console.log(`   ✅ Created ${created} missing creators`);
  } catch (error) {
    console.log(`   ⚠️  Error backfilling creators: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return created;
}

async function updateCreatorCounts(): Promise<number> {
  console.log('\n📊 Updating Creator Counts...');
  
  let updated = 0;
  
  try {
    // Get all creators
    const { data: creators } = await targetSupabase
      .from('creators_hot')
      .select('creator_id')
      .limit(10000);
    
    if (!creators) return 0;
    
    for (const creator of creators) {
      // Count videos for this creator
      const { count: videoCount } = await targetSupabase
        .from('videos_hot')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creator.creator_id);
      
      // Sum views and likes
      const { data: videos } = await targetSupabase
        .from('videos_hot')
        .select('views_count, likes_count')
        .eq('creator_id', creator.creator_id);
      
      const totalViews = videos?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
      const totalLikes = videos?.reduce((sum, v) => sum + (v.likes_count || 0), 0) || 0;
      
      // Update creator record
      const { error } = await targetSupabase
        .from('creators_hot')
        .update({
          videos_count: videoCount || 0,
          likes_total: totalLikes,
          updated_at: new Date().toISOString()
        })
        .eq('creator_id', creator.creator_id);
      
      if (!error) {
        updated++;
        if (updated % 50 === 0) {
          console.log(`   ✅ Updated ${updated}/${creators.length} creators`);
        }
      }
    }
    
    console.log(`   ✅ Updated ${updated} creator counts`);
  } catch (error) {
    console.log(`   ⚠️  Error updating creator counts: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return updated;
}

async function runAggregationFunction(): Promise<boolean> {
  console.log('\n🔄 Running Aggregation Functions...');
  
  try {
    // Try to call the update_aggregations function if it exists
    const { error } = await targetSupabase.rpc('update_aggregations');
    
    if (error) {
      // Function might not exist or have a different name
      console.log(`   ⚠️  Could not run update_aggregations: ${error.message}`);
      console.log(`   ℹ️  You may need to run aggregation SQL manually`);
      return false;
    }
    
    console.log('   ✅ Aggregation function completed');
    return true;
  } catch (error) {
    console.log(`   ⚠️  Error running aggregation: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function verifyCounts(): Promise<void> {
  console.log('\n🔍 Verifying Final Counts...');
  
  try {
    const { count: creatorCount } = await targetSupabase
      .from('creators_hot')
      .select('*', { count: 'exact', head: true });
    
    const { count: videoCount } = await targetSupabase
      .from('videos_hot')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Creators: ${creatorCount}`);
    console.log(`   Videos: ${videoCount}`);
    
    if (creatorCount === 530) {
      console.log(`   ✅ Creator count matches expected (530)`);
    } else {
      console.log(`   ⚠️  Creator count (${creatorCount}) differs from expected (530)`);
    }
    
    if (videoCount === 761) {
      console.log(`   ✅ Video count matches expected (761)`);
    } else {
      console.log(`   ⚠️  Video count (${videoCount}) differs from expected (761)`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error verifying counts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function backfillMissingData() {
  console.log('🔧 Backfilling Missing Data');
  console.log('============================\n');
  console.log(`Target: ${TARGET_URL}\n`);
  
  const stats: BackfillStats = {
    creatorsCreated: 0,
    videosCreated: 0,
    creatorCountsUpdated: 0,
    videoCountsUpdated: 0,
    errors: 0
  };
  
  // Step 1: Backfill missing creators
  stats.creatorsCreated = await backfillMissingCreators();
  
  // Step 2: Update creator counts
  stats.creatorCountsUpdated = await updateCreatorCounts();
  
  // Step 3: Run aggregation function if available
  await runAggregationFunction();
  
  // Step 4: Verify final counts
  await verifyCounts();
  
  // Summary
  console.log('\n\n📊 Backfill Summary');
  console.log('==================\n');
  
  console.log(`✅ Creators created: ${stats.creatorsCreated}`);
  console.log(`✅ Creator counts updated: ${stats.creatorCountsUpdated}`);
  console.log(`❌ Errors: ${stats.errors}`);
  
  console.log('\n📝 Next steps:');
  console.log('   1. Run check-source-data-migration.ts to verify all data is present');
  console.log('   2. Check that aggregate counts are correct');
  console.log('   3. Verify data integrity');
}

backfillMissingData().catch(error => {
  console.error('❌ Fatal error during backfill:', error);
  process.exit(1);
});

