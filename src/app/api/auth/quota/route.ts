import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { checkVideoSubmissionQuota } from '@/lib/quota-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/quota
 * Get current quota status for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const quotaStatus = await checkVideoSubmissionQuota(user.id, user.role);

    return NextResponse.json({
      limit: quotaStatus.limit,
      current: quotaStatus.current,
      remaining: quotaStatus.remaining,
      resetAt: quotaStatus.resetAt.toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    console.error('Quota check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

