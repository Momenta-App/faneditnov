import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('communities')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching community:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Check ownership or admin role
    const { data: community, error: fetchError } = await supabaseAdmin
      .from('communities')
      .select('created_by, linked_hashtags')
      .eq('id', params.id)
      .single();

    if (fetchError || !community) {
      return NextResponse.json(
        { error: 'Community not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Only admin can edit communities
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can edit communities', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const oldData = community;

    // Normalize hashtags if provided
    let normalizedHashtags = body.linked_hashtags;
    if (normalizedHashtags) {
      normalizedHashtags = normalizedHashtags.map((tag: string) => 
        tag.toLowerCase().replace(/^#/, '')
      );
    }

    // Prepare update object - only include fields that should be updated
    const updateData: any = {};
    const allowedFields = ['name', 'description', 'profile_image_url', 'cover_image_url', 'links', 'linked_hashtags'];
    
    for (const field of allowedFields) {
      if (field === 'linked_hashtags' && normalizedHashtags !== undefined) {
        updateData[field] = normalizedHashtags;
      } else if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('communities')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // If hashtags changed, sync memberships intelligently
    if (normalizedHashtags && JSON.stringify(oldData?.linked_hashtags) !== JSON.stringify(normalizedHashtags)) {
      const { data: syncResult, error: syncError } = await supabaseAdmin.rpc('sync_community_hashtags', {
        p_community_id: params.id,
        p_old_hashtags: oldData?.linked_hashtags || [],
        p_new_hashtags: normalizedHashtags
      });

      if (syncError) {
        console.error('Sync error:', syncError);
        // Fallback to full backfill if sync fails
        await supabaseAdmin.rpc('backfill_community', {
          p_community_id: params.id
        });
      } else {
        console.log('Sync result:', syncResult);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error);
    }

    console.error('Error updating community:', error);
    return NextResponse.json(
      { error: 'Failed to update community', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

