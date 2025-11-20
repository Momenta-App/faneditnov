import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';
import { extractHashtagsFromSuggestion, CampaignSuggestion } from '@/lib/openai';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns
 * List user's campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's campaigns, ordered by created_at DESC
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get total count
    const { count } = await supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign from an AI suggestion
 * Works exactly like community creation - uses linked_hashtags and backfill
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { input_text, ai_payload } = body;

    if (!input_text || typeof input_text !== 'string') {
      return NextResponse.json(
        { error: 'input_text is required' },
        { status: 400 }
      );
    }

    if (!ai_payload || typeof ai_payload !== 'object') {
      return NextResponse.json(
        { error: 'ai_payload is required' },
        { status: 400 }
      );
    }

    // Generate campaign name from AI payload
    const suggestion = ai_payload as CampaignSuggestion;
    let name: string;
    
    if (suggestion.category === 'media') {
      // Media format: "Franchise - Series" or just "Franchise"
      if (suggestion.franchise && suggestion.series) {
        name = `${suggestion.franchise} - ${suggestion.series}`;
      } else if (suggestion.franchise) {
        name = suggestion.franchise;
      } else {
        name = `${input_text.trim()} Campaign`;
      }
    } else {
      // Sports format: "Sport - League"
      if (suggestion.sport && suggestion.league) {
        name = `${suggestion.sport} - ${suggestion.league}`;
      } else if (suggestion.sport) {
        name = suggestion.sport;
      } else {
        name = `${input_text.trim()} Campaign`;
      }
    }

    // Extract all hashtags from AI payload (like communities)
    const hashtags = extractHashtagsFromSuggestion(suggestion);
    
    if (hashtags.length === 0) {
      return NextResponse.json(
        { error: 'No hashtags found in AI payload', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Normalize hashtags (lowercase, remove #) - exactly like communities
    const normalizedHashtags = hashtags.map((tag: string) => 
      tag.toLowerCase().replace(/^#/, '')
    );

    // Extract demographics from AI payload if present
    const demographics = suggestion.demographics || null;

    // Create campaign record - use linked_hashtags (TEXT[]) if column exists, otherwise use hashtags (JSONB)
    // This matches the community creation pattern exactly
    const insertData: any = {
      user_id: user.id,
      name,
      input_text: input_text.trim(),
      ai_payload,
      hashtags: hashtags, // JSONB for backwards compatibility
      video_ids: [], // Will be populated by backfill
    };

    // Add demographics if present (from migration 044)
    if (demographics) {
      insertData.demographics = demographics;
    }

    // Add linked_hashtags if the column exists (from migration 040)
    // Try to insert with linked_hashtags, fall back if column doesn't exist
    try {
      insertData.linked_hashtags = normalizedHashtags;
    } catch (e) {
      // Column might not exist yet, that's okay
    }

    const { data: campaign, error: insertError } = await supabaseAdmin
      .from('campaigns')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating campaign:', insertError);
      throw insertError;
    }

    // Trigger backfill (same as communities)
    // This will populate video_ids from linked_hashtags
    const { error: backfillError } = await supabaseAdmin.rpc('backfill_campaign', {
      p_campaign_id: campaign.id
    });

    if (backfillError) {
      // Log but don't fail - backfill can be retried later (same as communities)
      console.error('Backfill error (non-fatal):', backfillError);
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating campaign:', error);
    return NextResponse.json(
      {
        error: 'Failed to create campaign',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

