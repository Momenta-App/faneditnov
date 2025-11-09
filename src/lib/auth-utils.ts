/**
 * Authentication and authorization utilities for API routes
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getServerUserId } from './supabase-server';
import { supabaseAdmin } from './supabase';
import type { UserRole, Profile } from '@/app/types/data';

export type { UserRole } from '@/app/types/data';

export interface SessionUser extends Profile {
  // Profile already has all the fields we need
}

/**
 * Get current authenticated user from request
 * Supports both cookie-based sessions and Authorization header tokens
 * Returns null if not authenticated
 */
export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  try {
    // First try Authorization header (for client-side auth)
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use token-based session lookup
      const { getServerSessionFromRequest, getServerUserIdFromRequest } = await import('./supabase-server');
      userId = await getServerUserIdFromRequest(request);
    } else {
      // Fallback to cookie-based session
      userId = await getServerUserId();
    }

    if (!userId) {
      return null;
    }

    // Fetch profile from database
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return profile as SessionUser;
  } catch (error) {
    console.error('Error in getSessionUser:', error);
    return null;
  }
}

/**
 * Require authentication (throws 401 if not authenticated)
 */
export async function requireAuth(
  request: NextRequest
): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new AuthError('Unauthorized', 'UNAUTHORIZED', 401);
  }
  return user;
}

/**
 * Require specific role (throws 403 if not authorized)
 */
export async function requireRole(
  request: NextRequest,
  ...roles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth(request);
  if (!roles.includes(user.role)) {
    throw new AuthError(
      `Forbidden: Requires one of roles: ${roles.join(', ')}`,
      'FORBIDDEN',
      403
    );
  }
  return user;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
  request: NextRequest,
  ...roles: UserRole[]
): Promise<boolean> {
  const user = await getSessionUser(request);
  return user ? roles.includes(user.role) : false;
}

/**
 * Custom error class for auth errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR',
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Handle auth errors and return appropriate response
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'VALIDATION_ERROR',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'VALIDATION_ERROR',
    },
    { status: 500 }
  );
}

