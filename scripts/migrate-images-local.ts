/**
 * Local script to migrate images to Supabase Storage
 * Run with: npx tsx scripts/migrate-images-local.ts
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { supabaseAdmin } from '../src/lib/supabase';
import { downloadAndStoreImage, isSupabaseUrl } from '../src/lib/image-storage';

async function migrateImages() {
  console.log('🚀 Starting image migration...\n');

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  // Migrate video covers
  console.log('📦 Fetching videos with unmigrated covers...');
  const { data: videos } = await supabaseAdmin!
    .from('videos_hot')
    .select('video_id, cover_url')
    .not('cover_url', 'is', null);

  console.log(`Found ${videos?.length || 0} videos total\n`);

  for (const video of videos || []) {
    if (isSupabaseUrl(video.cover_url)) {
      skipped++;
      continue;
    }

    console.log(`Processing video: ${video.video_id}`);
    const result = await downloadAndStoreImage(
      video.cover_url,
      'video-cover',
      video.video_id
    );

    if (result.success && result.supabaseUrl) {
      const { error: updateError } = await supabaseAdmin!
        .from('videos_hot')
        .update({ cover_url: result.supabaseUrl })
        .eq('video_id', video.video_id);

      if (updateError) {
        console.error(`  ✗ Failed to update database:`, updateError.message);
        errors++;
      } else {
        console.log(`  ✓ Migrated successfully`);
        processed++;
      }
    } else {
      console.error(`  ✗ Failed to download/upload:`, result.error);
      errors++;
    }
  }

  // Migrate creator avatars
  console.log('\n👤 Fetching creators with unmigrated avatars...');
  const { data: creators } = await supabaseAdmin!
    .from('creators_hot')
    .select('creator_id, avatar_url')
    .not('avatar_url', 'is', null);

  console.log(`Found ${creators?.length || 0} creators total\n`);

  for (const creator of creators || []) {
    if (isSupabaseUrl(creator.avatar_url)) {
      skipped++;
      continue;
    }

    console.log(`Processing creator: ${creator.creator_id}`);
    const result = await downloadAndStoreImage(
      creator.avatar_url,
      'creator-avatar',
      creator.creator_id
    );

    if (result.success && result.supabaseUrl) {
      const { error: updateError } = await supabaseAdmin!
        .from('creators_hot')
        .update({ avatar_url: result.supabaseUrl })
        .eq('creator_id', creator.creator_id);

      if (updateError) {
        console.error(`  ✗ Failed to update database:`, updateError.message);
        errors++;
      } else {
        console.log(`  ✓ Migrated successfully`);
        processed++;
      }
    } else {
      console.error(`  ✗ Failed to download/upload:`, result.error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ Migration Complete!');
  console.log('='.repeat(50));
  console.log(`✓ Processed: ${processed}`);
  console.log(`✗ Errors: ${errors}`);
  console.log(`⊘ Skipped (already migrated): ${skipped}`);
  console.log('='.repeat(50));
}

migrateImages().catch(console.error);

