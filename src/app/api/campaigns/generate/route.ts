import { NextRequest, NextResponse } from 'next/server';
import { generateCampaignSuggestions } from '@/lib/openai';
import { requireAuth, handleAuthError, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/campaigns/generate
 * Generate AI suggestions for a region/market search
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth(request);

    const body = await request.json();
    const { input_text } = body;

    if (!input_text || typeof input_text !== 'string' || input_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'input_text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Generate suggestions using OpenAI
    const suggestions = await generateCampaignSuggestions(input_text.trim());

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    // Handle auth errors properly
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error generating campaign suggestions:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate campaign suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

