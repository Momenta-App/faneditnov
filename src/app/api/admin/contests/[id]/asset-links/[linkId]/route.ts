/**
 * Admin API routes for managing individual contest asset links
 * PATCH: Update an asset link
 * DELETE: Delete an asset link
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/auth-utils';
import { AuthError, handleAuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/contests/[id]/asset-links/[linkId]
 * Update an asset link
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id, linkId } = await params;

    const body = await request.json();
    const { name, url, display_order } = body;

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) {
      // Validate URL format
      try {
        new URL(url);
        updateData.url = url;
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }
    if (display_order !== undefined) updateData.display_order = display_order;

    // Verify the asset link belongs to this contest
    const { data: existingLink, error: fetchError } = await supabaseAdmin
      .from('contest_asset_links')
      .select('contest_id')
      .eq('id', linkId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Asset link not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    if (existingLink.contest_id !== id) {
      return NextResponse.json(
        { error: 'Asset link does not belong to this contest' },
        { status: 403 }
      );
    }

    // Update asset link
    const { data: assetLink, error } = await supabaseAdmin
      .from('contest_asset_links')
      .update(updateData)
      .eq('id', linkId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: assetLink,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error updating asset link:', error);
    return NextResponse.json(
      { error: 'Failed to update asset link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/contests/[id]/asset-links/[linkId]
 * Delete an asset link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id, linkId } = await params;

    // Verify the asset link belongs to this contest
    const { data: existingLink, error: fetchError } = await supabaseAdmin
      .from('contest_asset_links')
      .select('contest_id')
      .eq('id', linkId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Asset link not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    if (existingLink.contest_id !== id) {
      return NextResponse.json(
        { error: 'Asset link does not belong to this contest' },
        { status: 403 }
      );
    }

    // Delete asset link
    const { error } = await supabaseAdmin
      .from('contest_asset_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;

    return NextResponse.json({
      message: 'Asset link deleted successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error deleting asset link:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset link' },
      { status: 500 }
    );
  }
}

