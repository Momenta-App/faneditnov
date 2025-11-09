/**
 * Simple local script to migrate images to Supabase Storage
 * Run with: npx tsx scripts/migrate-images-simple.ts
 */

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Create Supabase client directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'brightdata-results';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Image download and upload function
async function downloadAndStoreImage(
  tiktokImageUrl: string,
  imageType: string,
  entityId: string
) {
  try {
    if (!tiktokImageUrl || !tiktokImageUrl.startsWith('http')) {
      return { success: false, error: 'Invalid image URL' };
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(tiktokImageUrl, { 
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { 
        success: false, 
        error: `Failed to download: ${response.status}` 
      };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    const ext = contentType.includes('png') ? 'png' 
      : contentType.includes('webp') ? 'webp' 
      : 'jpg';

    const hash = crypto.createHash('md5').update(tiktokImageUrl).digest('hex').slice(0, 8);
    const filename = `${imageType}/${entityId}-${hash}.${ext}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: true
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    return {
      success: true,
      supabaseUrl: publicUrlData.publicUrl
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

function isSupabaseUrl(url: string): boolean {
  return !!(url && url.includes('supabase.co') && url.includes('/storage/'));
}

async function migrateImages() {
  console.log('🚀 Starting image migration...\n');

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  // Migrate video covers
  console.log('📦 Fetching videos with unmigrated covers...');
  const { data: videos } = await supabase
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
      const { error: updateError } = await supabase
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
  const { data: creators } = await supabase
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
      const { error: updateError } = await supabase
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

migrateImages()
  .catch(console.error)
  .finally(() => process.exit(0));

