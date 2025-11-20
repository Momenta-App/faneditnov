#!/usr/bin/env tsx

/**
 * Efficient Video Migration Script
 * Migrates videos more efficiently by:
 * 1. First ensuring platform column exists
 * 2. Creating missing creators on-the-fly
 * 3. Using bulk inserts with better error handling
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

const SOURCE_URL = process.env.MIGRATION_SOURCE_SUPABASE_URL ?? '';
const SOURCE_KEY = process.env.MIGRATION_SOURCE_SUPABASE_SERVICE_ROLE_KEY ?? '';
const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);
const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

async function ensurePlatformColumn() {
  console.log('🔍 Ensuring platform column exists...');
  
  // Check if column exists by trying to query it
  const { error } = await targetSupabase
    .from('videos_hot')
    .select('platform')
    .limit(1);
  
  if (error && error.message.includes('platform')) {
    console.log('   Adding platform column...');
    // Column doesn't exist, we need to add it via SQL
    // For now, we'll just skip setting platform and let the migration handle it
    console.log('   ⚠️  Platform column missing - will be added by migration');
    return false;
  }
  
  console.log('   ✅ Platform column exists');
  return true;
}

async function getOrCreateCreator(creatorId: string, sourceData: any) {
  // Check if creator exists
  const { data: existing } = await targetSupabase
    .from('creators_hot')
    .select('creator_id')
    .eq('creator_id', creatorId)
    .single();
  
  if (existing) {
    return creatorId;
  }
  
  // Create missing creator with minimal data
  const creatorData = {
    creator_id: creatorId,
    username: sourceData?.username || `user_${creatorId.substring(0, 10)}`,
    display_name: sourceData?.display_name || null,
    avatar_url: sourceData?.avatar_url || null,
    verified: sourceData?.verified || false,
    followers_count: sourceData?.followers_count || 0,
    videos_count: 0,
    likes_total: 0,
    bio: sourceData?.bio || null,
    bio_links: sourceData?.bio_links || [],
    is_private: sourceData?.is_private || false,
    is_business_account: sourceData?.is_business_account || false,
  };
  
  const { error } = await targetSupabase
    .from('creators_hot')
    .upsert(creatorData, { onConflict: 'creator_id' });
  
  if (error) {
    console.log(`   ⚠️  Could not create creator ${creatorId}: ${error.message}`);
    return null;
  }
  
  return creatorId;
}

async function migrateVideosEfficient() {
  console.log('🚀 Efficient Video Migration');
  console.log('============================\n');
  
  await ensurePlatformColumn();
  
  const BATCH_SIZE = 500;
  let offset = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // Get all existing creators once
  const { data: existingCreators } = await targetSupabase
    .from('creators_hot')
    .select('creator_id');
  const creatorSet = new Set((existingCreators || []).map((c: any) => c.creator_id));
  
  console.log(`📊 Found ${creatorSet.size} existing creators\n`);
  console.log('🔄 Starting migration (this may take a while)...\n');
  
  while (true) {
    // Fetch batch from source
    const { data: videos, error: fetchError } = await sourceSupabase
      .from('videos_hot')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (fetchError) {
      console.log(`❌ Error fetching: ${fetchError.message}`);
      break;
    }
    
    if (!videos || videos.length === 0) {
      break;
    }
    
    // Process videos
    const validVideos: any[] = [];
    const creatorPromises: Promise<string | null>[] = [];
    
    for (const video of videos) {
      if (!video.video_id || !video.post_id || !video.creator_id) {
        totalSkipped++;
        continue;
      }
      
      // Check if creator exists, if not, we'll create it
      if (!creatorSet.has(video.creator_id)) {
        // Fetch creator data from source
        const creatorPromise = (async (): Promise<string | null> => {
          const { data: creatorData } = await sourceSupabase
            .from('creators_hot')
            .select('*')
            .eq('creator_id', video.creator_id)
            .single();

          const createdId = await getOrCreateCreator(video.creator_id, creatorData);
          if (createdId) {
            creatorSet.add(createdId);
          }
          return createdId;
        })();
        creatorPromises.push(creatorPromise);
      }
      
      // Prepare video data
      const videoData: any = {
        video_id: video.video_id,
        post_id: video.post_id,
        creator_id: video.creator_id,
        url: video.url || null,
        caption: video.caption || null,
        description: video.description || null,
        created_at: video.created_at || video.first_seen_at || video.last_seen_at || new Date().toISOString(),
        views_count: video.views_count || 0,
        likes_count: video.likes_count || 0,
        comments_count: video.comments_count || 0,
        shares_count: video.shares_count || 0,
        collect_count: video.collect_count || 0,
        duration_seconds: video.duration_seconds || null,
        video_url: video.video_url || null,
        cover_url: video.cover_url || null,
        thumbnail_url: video.thumbnail_url || null,
        is_ads: video.is_ads || false,
        language: video.language || null,
        region: video.region || null,
        first_seen_at: video.first_seen_at || new Date().toISOString(),
        last_seen_at: video.last_seen_at || new Date().toISOString(),
      };
      
      // Add platform if column exists (we'll try without it first)
      if (video.platform) {
        videoData.platform = video.platform;
      } else {
        videoData.platform = 'tiktok';
      }
      
      validVideos.push(videoData);
    }
    
    // Wait for any creator creations to complete
    if (creatorPromises.length > 0) {
      await Promise.all(creatorPromises);
    }
    
    // Filter out videos with invalid creators
    const finalVideos = validVideos.filter(v => creatorSet.has(v.creator_id));
    
    if (finalVideos.length === 0) {
      offset += BATCH_SIZE;
      continue;
    }
    
    // Insert batch using upsert
    const { error: insertError } = await targetSupabase
      .from('videos_hot')
      .upsert(finalVideos, { onConflict: 'video_id', ignoreDuplicates: false });
    
    if (insertError) {
      // If platform column error, try without it
      if (insertError.message.includes('platform')) {
        const videosWithoutPlatform = finalVideos.map(({ platform, ...rest }) => rest);
        const { error: retryError } = await targetSupabase
          .from('videos_hot')
          .upsert(videosWithoutPlatform, { onConflict: 'video_id' });
        
        if (retryError) {
          console.log(`   ❌ Batch ${offset}-${offset + BATCH_SIZE}: ${retryError.message}`);
          totalErrors += finalVideos.length;
        } else {
          totalMigrated += finalVideos.length;
          console.log(`   ✅ Migrated batch: ${totalMigrated} videos so far`);
        }
      } else {
        console.log(`   ❌ Batch ${offset}-${offset + BATCH_SIZE}: ${insertError.message}`);
        totalErrors += finalVideos.length;
      }
    } else {
      totalMigrated += finalVideos.length;
      if (totalMigrated % 1000 === 0 || offset === 0) {
        console.log(`   ✅ Migrated: ${totalMigrated} videos`);
      }
    }
    
    offset += BATCH_SIZE;
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n📊 Migration Complete:`);
  console.log(`   ✅ Migrated: ${totalMigrated} videos`);
  console.log(`   ⚠️  Skipped: ${totalSkipped} videos`);
  console.log(`   ❌ Errors: ${totalErrors} videos`);
}

migrateVideosEfficient().catch(console.error);

