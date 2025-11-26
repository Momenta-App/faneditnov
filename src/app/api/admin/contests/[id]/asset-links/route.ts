/**
 * Admin API routes for managing contest asset links
 * GET: List asset links for a contest
 * POST: Create a new asset link
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/auth-utils';
import { AuthError, handleAuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]/asset-links
 * List all asset links for a contest
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const { data: assetLinks, error } = await supabaseAdmin
      .from('contest_asset_links')
      .select('*')
      .eq('contest_id', id)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      data: assetLinks || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching asset links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contests/[id]/asset-links
 * Create a new asset link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const body = await request.json();
    const { name, url, display_order } = body;

    // Validation
    if (!name || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Create asset link
    const { data: assetLink, error } = await supabaseAdmin
      .from('contest_asset_links')
      .insert({
        contest_id: id,
        name,
        url,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: assetLink,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating asset link:', error);
    return NextResponse.json(
      { error: 'Failed to create asset link' },
      { status: 500 }
    );
  }
}

