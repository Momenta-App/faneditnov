import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole, handleAuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort') || 'views';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const timeRange = searchParams.get('timeRange') || 'all';

    // Map timeRange to days for database function
    const timeRangeToDays: { [key: string]: number | null } = {
      'all': null,
      '7d': 7,
      '30d': 30,
      'year': 365,
    };

    const days = timeRangeToDays[timeRange] ?? null;

    // Use RPC function for time-windowed queries or all-time
    const { data, error } = await supabaseAdmin.rpc(
      'get_communities_by_timerange',
      {
        p_days: days,
        p_sort_by: sortBy,
        p_search: search || null,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (error) throw error;

    // For count, we return the number of items returned (since we're filtering by time)
    // A proper count would require a separate query, but for now this is sufficient
    const count = data?.length || 0;

    return NextResponse.json({
      data: data || [],
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch communities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin role only
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const { name, slug, description, linked_hashtags, profile_image_url, cover_image_url, links } = body;

    // Validate required fields
    if (!name || !slug || !linked_hashtags || linked_hashtags.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Normalize hashtags (lowercase, remove #)
    const normalizedHashtags = linked_hashtags.map((tag: string) => 
      tag.toLowerCase().replace(/^#/, '')
    );

    // Insert community with created_by set to current user
    const { data, error } = await supabaseAdmin
      .from('communities')
      .insert({
        name,
        slug,
        description,
        linked_hashtags: normalizedHashtags,
        profile_image_url,
        cover_image_url,
        links: links || {},
        created_by: user.id // Set owner
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger backfill
    const { error: backfillError } = await supabaseAdmin.rpc('backfill_community', {
      p_community_id: data.id
    });

    if (backfillError) {
      console.error('Backfill error:', backfillError);
    }

    return NextResponse.json(data);
  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error);
    }

    console.error('Error creating community:', error);
    return NextResponse.json(
      { error: 'Failed to create community', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

