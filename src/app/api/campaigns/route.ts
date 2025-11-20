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

    // Generate campaign name from input_text
    const name = `${input_text.trim()} Campaign`;

    // Extract all hashtags from AI payload
    const suggestion = ai_payload as CampaignSuggestion;
    const hashtags = extractHashtagsFromSuggestion(suggestion);

    if (hashtags.length === 0) {
      return NextResponse.json(
        { error: 'No hashtags found in AI payload' },
        { status: 400 }
      );
    }

    // Query video_hashtag_facts to find videos matching any hashtag
    const { data: hashtagVideos, error: hashtagError } = await supabaseAdmin
      .from('video_hashtag_facts')
      .select('video_id')
      .in('hashtag', hashtags);

    if (hashtagError) {
      console.error('Error querying video_hashtag_facts:', hashtagError);
      throw hashtagError;
    }

    // Get unique video IDs
    const videoIds = [...new Set((hashtagVideos || []).map((v) => v.video_id))];

    // Create campaign record
    const { data: campaign, error: insertError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        input_text: input_text.trim(),
        ai_payload,
        hashtags,
        video_ids: videoIds,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating campaign:', insertError);
      throw insertError;
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

