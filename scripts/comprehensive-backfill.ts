#!/usr/bin/env tsx

/**
 * Comprehensive Data Backfill Script
 * Backfills all hashtags, creators, aggregates, campaigns, communities, and homepage cache
 * 
 * Usage:
 *   npx tsx scripts/comprehensive-backfill.ts
 * 
 * Prerequisites:
 *   - .env.local with SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
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

const supabase = createClient(TARGET_URL, TARGET_KEY);

interface BackfillStats {
  hashtagsCreated: number;
  hashtagRelationshipsCreated: number;
  creatorsCreated: number;
  campaignsBackfilled: number;
  communitiesBackfilled: number;
  errors: number;
}

/**
 * Normalize hashtag: lowercase, remove #, trim
 */
function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, '').trim();
}

/**
 * Extract hashtags from JSONB data
 */
function extractHashtags(hashtagsData: any): string[] {
  if (!hashtagsData) return [];
  
  const hashtags: string[] = [];
  
  // Handle array of strings
  if (Array.isArray(hashtagsData)) {
    for (const item of hashtagsData) {
      if (typeof item === 'string') {
        const normalized = normalizeHashtag(item);
        if (normalized && normalized !== 'null') {
          hashtags.push(normalized);
        }
      } else if (typeof item === 'object' && item !== null && 'hashtag' in item) {
        const normalized = normalizeHashtag(item.hashtag);
        if (normalized && normalized !== 'null') {
          hashtags.push(normalized);
        }
      }
    }
  } 
  // Handle single string
  else if (typeof hashtagsData === 'string') {
    const normalized = normalizeHashtag(hashtagsData);
    if (normalized && normalized !== 'null') {
      hashtags.push(normalized);
    }
  }
  
  return [...new Set(hashtags)]; // Remove duplicates
}

/**
 * Backfill hashtags from videos_cold
 */
async function backfillHashtagsFromVideos(): Promise<{ hashtagsCreated: number; relationshipsCreated: number }> {
  console.log('\n📦 Backfilling Hashtags from Videos...');
  
  let hashtagsCreated = 0;
  let relationshipsCreated = 0;
  let processedVideos = 0;
  
  try {
    // Get all videos with their cold data
    const { data: videos, error: videosError } = await supabase
      .from('videos_cold')
      .select('video_id, full_json, hashtags')
      .limit(10000);
    
    if (videosError) {
      console.error('   ⚠️  Error fetching videos:', videosError);
      return { hashtagsCreated: 0, relationshipsCreated: 0 };
    }
    
    if (!videos || videos.length === 0) {
      console.log('   ℹ️  No videos found in videos_cold');
      return { hashtagsCreated: 0, relationshipsCreated: 0 };
    }
    
    console.log(`   📹 Processing ${videos.length} videos...`);
    
    // Process videos in batches
    const batchSize = 100;
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      
      for (const video of batch) {
        try {
          // Extract hashtags from full_json or hashtags field
          let hashtags: string[] = [];
          
          if (video.hashtags && Array.isArray(video.hashtags)) {
            hashtags = video.hashtags.map(normalizeHashtag).filter(h => h && h !== 'null');
          } else if (video.full_json) {
            const hashtagsData = video.full_json.hashtags;
            hashtags = extractHashtags(hashtagsData);
          }
          
          if (hashtags.length === 0) continue;
          
          // Get video views and likes for snapshot
          const { data: videoHot } = await supabase
            .from('videos_hot')
            .select('views_count, likes_count')
            .eq('video_id', video.video_id)
            .single();
          
          const viewsAtSnapshot = videoHot?.views_count || 0;
          const likesAtSnapshot = videoHot?.likes_count || 0;
          
          // Insert hashtags and relationships
          for (const hashtag of hashtags) {
            // Insert hashtag into hashtags_hot
            const { error: hashtagError } = await supabase
              .from('hashtags_hot')
              .upsert({
                hashtag: hashtag,
                hashtag_norm: hashtag,
                updated_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString()
              }, {
                onConflict: 'hashtag',
                ignoreDuplicates: false
              });
            
            if (!hashtagError) {
              hashtagsCreated++;
            }
            
            // Insert relationship into video_hashtag_facts
            const { error: factError } = await supabase
              .from('video_hashtag_facts')
              .upsert({
                video_id: video.video_id,
                hashtag: hashtag,
                snapshot_at: new Date().toISOString(),
                views_at_snapshot: viewsAtSnapshot,
                likes_at_snapshot: likesAtSnapshot
              }, {
                onConflict: 'video_id,hashtag',
                ignoreDuplicates: false
              });
            
            if (!factError) {
              relationshipsCreated++;
            }
          }
          
          processedVideos++;
          if (processedVideos % 100 === 0) {
            console.log(`   ✅ Processed ${processedVideos}/${videos.length} videos (${hashtagsCreated} hashtags, ${relationshipsCreated} relationships)`);
          }
        } catch (error) {
          console.error(`   ⚠️  Error processing video ${video.video_id}:`, error);
        }
      }
    }
    
    console.log(`   ✅ Created ${hashtagsCreated} hashtags and ${relationshipsCreated} relationships from ${processedVideos} videos`);
  } catch (error) {
    console.error(`   ⚠️  Error backfilling hashtags: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return { hashtagsCreated, relationshipsCreated };
}

/**
 * Backfill missing creators
 */
async function backfillMissingCreators(): Promise<number> {
  console.log('\n👥 Backfilling Missing Creators...');
  
  let created = 0;
  
  try {
    // Get all unique creator_ids from videos_hot
    const { data: videos } = await supabase
      .from('videos_hot')
      .select('creator_id')
      .limit(50000);
    
    if (!videos) return 0;
    
    const uniqueCreatorIds = [...new Set(videos.map(v => v.creator_id).filter(Boolean))];
    console.log(`   📊 Found ${uniqueCreatorIds.length} unique creator IDs`);
    
    // Check which creators exist
    const { data: existingCreators } = await supabase
      .from('creators_hot')
      .select('creator_id')
      .in('creator_id', uniqueCreatorIds);
    
    const existingIds = new Set(existingCreators?.map(c => c.creator_id) || []);
    const missingIds = uniqueCreatorIds.filter(id => !existingIds.has(id));
    
    console.log(`   📊 Missing ${missingIds.length} creators`);
    
    // Create missing creators in batches
    const batchSize = 50;
    for (let i = 0; i < missingIds.length; i += batchSize) {
      const batch = missingIds.slice(i, i + batchSize);
      
      const creatorsToInsert = batch.map(creatorId => ({
        creator_id: creatorId,
        username: creatorId || 'unknown',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('creators_hot')
        .insert(creatorsToInsert);
      
      if (!error) {
        created += batch.length;
        if (created % 100 === 0) {
          console.log(`   ✅ Created ${created}/${missingIds.length} missing creators`);
        }
      }
    }
    
    console.log(`   ✅ Created ${created} missing creators`);
  } catch (error) {
    console.error(`   ⚠️  Error backfilling creators: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return created;
}

/**
 * Update all aggregates
 */
async function updateAggregates(): Promise<boolean> {
  console.log('\n🔄 Updating Aggregates...');
  
  try {
    const { data, error } = await supabase.rpc('update_aggregations');
    
    if (error) {
      console.error(`   ⚠️  Error updating aggregates: ${error.message}`);
      return false;
    }
    
    console.log('   ✅ Aggregates updated:', data);
    return true;
  } catch (error) {
    console.error(`   ⚠️  Error updating aggregates: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Backfill all campaigns
 */
async function backfillCampaigns(): Promise<number> {
  console.log('\n📢 Backfilling Campaigns...');
  
  let backfilled = 0;
  
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id');
    
    if (error) {
      console.error(`   ⚠️  Error fetching campaigns: ${error.message}`);
      return 0;
    }
    
    if (!campaigns || campaigns.length === 0) {
      console.log('   ℹ️  No campaigns found');
      return 0;
    }
    
    console.log(`   📊 Found ${campaigns.length} campaigns`);
    
    for (const campaign of campaigns) {
      try {
        const { error: backfillError } = await supabase.rpc('backfill_campaign', {
          p_campaign_id: campaign.id
        });
        
        if (!backfillError) {
          backfilled++;
          if (backfilled % 10 === 0) {
            console.log(`   ✅ Backfilled ${backfilled}/${campaigns.length} campaigns`);
          }
        } else {
          console.error(`   ⚠️  Error backfilling campaign ${campaign.id}:`, backfillError.message);
        }
      } catch (error) {
        console.error(`   ⚠️  Error backfilling campaign ${campaign.id}:`, error);
      }
    }
    
    console.log(`   ✅ Backfilled ${backfilled} campaigns`);
  } catch (error) {
    console.error(`   ⚠️  Error backfilling campaigns: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return backfilled;
}

/**
 * Backfill all communities
 */
async function backfillCommunities(): Promise<number> {
  console.log('\n👥 Backfilling Communities...');
  
  let backfilled = 0;
  
  try {
    const { data: communities, error } = await supabase
      .from('communities')
      .select('id');
    
    if (error) {
      console.error(`   ⚠️  Error fetching communities: ${error.message}`);
      return 0;
    }
    
    if (!communities || communities.length === 0) {
      console.log('   ℹ️  No communities found');
      return 0;
    }
    
    console.log(`   📊 Found ${communities.length} communities`);
    
    for (const community of communities) {
      try {
        const { error: backfillError } = await supabase.rpc('backfill_community', {
          p_community_id: community.id
        });
        
        if (!backfillError) {
          backfilled++;
          if (backfilled % 10 === 0) {
            console.log(`   ✅ Backfilled ${backfilled}/${communities.length} communities`);
          }
        } else {
          console.error(`   ⚠️  Error backfilling community ${community.id}:`, backfillError.message);
        }
      } catch (error) {
        console.error(`   ⚠️  Error backfilling community ${community.id}:`, error);
      }
    }
    
    console.log(`   ✅ Backfilled ${backfilled} communities`);
  } catch (error) {
    console.error(`   ⚠️  Error backfilling communities: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return backfilled;
}

/**
 * Refresh homepage cache
 */
async function refreshHomepageCache(): Promise<boolean> {
  console.log('\n🏠 Refreshing Homepage Cache...');
  
  try {
    const { data, error } = await supabase.rpc('refresh_homepage_cache');
    
    if (error) {
      console.error(`   ⚠️  Error refreshing homepage cache: ${error.message}`);
      return false;
    }
    
    console.log('   ✅ Homepage cache refreshed:', data);
    return true;
  } catch (error) {
    console.error(`   ⚠️  Error refreshing homepage cache: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main backfill function
 */
async function comprehensiveBackfill() {
  console.log('🔧 Comprehensive Data Backfill');
  console.log('==============================\n');
  console.log(`Target: ${TARGET_URL}\n`);
  
  const stats: BackfillStats = {
    hashtagsCreated: 0,
    hashtagRelationshipsCreated: 0,
    creatorsCreated: 0,
    campaignsBackfilled: 0,
    communitiesBackfilled: 0,
    errors: 0
  };
  
  // Step 1: Backfill hashtags from videos
  const hashtagResults = await backfillHashtagsFromVideos();
  stats.hashtagsCreated = hashtagResults.hashtagsCreated;
  stats.hashtagRelationshipsCreated = hashtagResults.relationshipsCreated;
  
  // Step 2: Backfill missing creators
  stats.creatorsCreated = await backfillMissingCreators();
  
  // Step 3: Update all aggregates
  await updateAggregates();
  
  // Step 4: Backfill campaigns
  stats.campaignsBackfilled = await backfillCampaigns();
  
  // Step 5: Backfill communities
  stats.communitiesBackfilled = await backfillCommunities();
  
  // Step 6: Refresh homepage cache
  await refreshHomepageCache();
  
  // Summary
  console.log('\n\n📊 Backfill Summary');
  console.log('==================\n');
  
  console.log(`✅ Hashtags created: ${stats.hashtagsCreated}`);
  console.log(`✅ Hashtag relationships created: ${stats.hashtagRelationshipsCreated}`);
  console.log(`✅ Creators created: ${stats.creatorsCreated}`);
  console.log(`✅ Campaigns backfilled: ${stats.campaignsBackfilled}`);
  console.log(`✅ Communities backfilled: ${stats.communitiesBackfilled}`);
  console.log(`❌ Errors: ${stats.errors}`);
  
  console.log('\n📝 Next steps:');
  console.log('   1. Verify hashtag search works (e.g., search for "cricket")');
  console.log('   2. Check campaign video counts');
  console.log('   3. Verify homepage statistics');
  console.log('   4. Test creator profile pages');
}

comprehensiveBackfill().catch(error => {
  console.error('❌ Fatal error during backfill:', error);
  process.exit(1);
});

