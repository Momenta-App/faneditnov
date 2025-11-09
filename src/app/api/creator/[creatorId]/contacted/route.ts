import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creator/[creatorId]/contacted
 * Check if the current user has contacted this creator
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { creatorId } = await params;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Check if user has contacted this creator
    const { data: contact, error } = await supabaseAdmin
      .from('creator_contacts')
      .select('id, contacted_at')
      .eq('user_id', user.id)
      .eq('creator_id', creatorId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected if not contacted)
      console.error('Error checking contact status:', error);
      return NextResponse.json(
        { error: 'Failed to check contact status', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contacted: !!contact,
      contactedAt: contact?.contacted_at || null,
    });
  } catch (error) {
    console.error('Error in contacted API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/[creatorId]/contacted
 * Mark that the current user has contacted this creator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { creatorId } = await params;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Insert contact record (UNIQUE constraint will prevent duplicates)
    const { data: contact, error } = await supabaseAdmin
      .from('creator_contacts')
      .insert({
        user_id: user.id,
        creator_id: creatorId,
      })
      .select('id, contacted_at')
      .single();

    if (error) {
      // If unique constraint violation, user already contacted this creator
      if (error.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('creator_contacts')
          .select('id, contacted_at')
          .eq('user_id', user.id)
          .eq('creator_id', creatorId)
          .single();

        return NextResponse.json({
          contacted: true,
          contactedAt: existing?.contacted_at || new Date().toISOString(),
        });
      }

      console.error('Error saving contact:', error);
      return NextResponse.json(
        { error: 'Failed to save contact', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contacted: true,
      contactedAt: contact?.contacted_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in contacted API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

