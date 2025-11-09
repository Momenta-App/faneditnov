import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { downloadAndStoreImage, isSupabaseUrl } from '@/lib/image-storage';
import { getSupabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for Vercel Pro

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { type, limit = 100, offset = 0 } = await request.json();

    if (!['video-covers', 'creator-avatars', 'sound-covers', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: video-covers, creator-avatars, sound-covers, or all' },
        { status: 400 }
      );
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    if (type === 'video-covers' || type === 'all') {
      console.log('Migrating video covers...');
      // Migrate video covers
      const { data: videos } = await supabaseAdmin!
        .from('videos_hot')
        .select('video_id, cover_url')
        .not('cover_url', 'is', null)
        .range(offset, offset + limit - 1);

      for (const video of videos || []) {
        if (isSupabaseUrl(video.cover_url)) {
          skipped++;
          continue;
        }

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
            console.error(`Failed to update video ${video.video_id}:`, updateError);
            errors++;
          } else {
            processed++;
            console.log(`✓ Migrated video cover: ${video.video_id}`);
          }
        } else {
          console.error(`Failed to migrate video ${video.video_id}:`, result.error);
          errors++;
        }
      }
    }

    if (type === 'creator-avatars' || type === 'all') {
      console.log('Migrating creator avatars...');
      // Migrate creator avatars
      const { data: creators } = await supabaseAdmin!
        .from('creators_hot')
        .select('creator_id, avatar_url')
        .not('avatar_url', 'is', null)
        .range(offset, offset + limit - 1);

      for (const creator of creators || []) {
        if (isSupabaseUrl(creator.avatar_url)) {
          skipped++;
          continue;
        }

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
            console.error(`Failed to update creator ${creator.creator_id}:`, updateError);
            errors++;
          } else {
            processed++;
            console.log(`✓ Migrated creator avatar: ${creator.creator_id}`);
          }
        } else {
          console.error(`Failed to migrate creator ${creator.creator_id}:`, result.error);
          errors++;
        }
      }
    }

    if (type === 'sound-covers' || type === 'all') {
      console.log('Migrating sound covers...');
      // Migrate sound covers
      const { data: sounds } = await supabaseAdmin!
        .from('sounds_hot')
        .select('sound_id, cover_url')
        .not('cover_url', 'is', null)
        .range(offset, offset + limit - 1);

      for (const sound of sounds || []) {
        if (isSupabaseUrl(sound.cover_url)) {
          skipped++;
          continue;
        }

        const result = await downloadAndStoreImage(
          sound.cover_url,
          'sound-cover',
          sound.sound_id
        );

        if (result.success && result.supabaseUrl) {
          const { error: updateError } = await supabaseAdmin!
            .from('sounds_hot')
            .update({ cover_url: result.supabaseUrl })
            .eq('sound_id', sound.sound_id);

          if (updateError) {
            console.error(`Failed to update sound ${sound.sound_id}:`, updateError);
            errors++;
          } else {
            processed++;
            console.log(`✓ Migrated sound cover: ${sound.sound_id}`);
          }
        } else {
          console.error(`Failed to migrate sound ${sound.sound_id}:`, result.error);
          errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      skipped,
      message: `Migrated ${processed} images, ${errors} errors, ${skipped} already migrated`
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Admin Image Migration Endpoint',
    usage: 'POST with JSON body: { "type": "video-covers|creator-avatars|sound-covers|all", "limit": 100, "offset": 0 }',
  });
}

