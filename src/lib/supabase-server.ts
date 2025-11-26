/**
 * Server-side Supabase client for API routes
 * Gets the authenticated user's session from cookies
 */
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { envClient } from './env-client';
import { supabaseAdmin } from './supabase';

/**
 * Get a Supabase client with the user's session (from cookies)
 * Use this in API routes to get the authenticated user
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  
  const client = createClient(
    envClient.NEXT_PUBLIC_SUPABASE_URL,
    envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Cookie: cookieStore.toString(),
        },
      },
    }
  );

  return client;
}

/**
 * Get a Supabase client using the Authorization header when present.
 * Falls back to cookies if no Authorization header is provided.
 * Note: For server-side use, prefer getServerSessionFromRequest() which handles tokens better.
 */
export async function getSupabaseFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Create client with Authorization header
    const client = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );
    return client;
  }

  // For cookie-based session, extract cookies from the request
  // Prefer request cookies (from fetch) over server cookies (from next/headers)
  const requestCookieHeader = request.headers.get('cookie');
  const cookieStore = await cookies();
  const serverCookieHeader = cookieStore.toString();
  
  // Use request cookies if available, otherwise fall back to server cookies
  const cookieHeader = requestCookieHeader || serverCookieHeader;
  
  const client = createClient(
    envClient.NEXT_PUBLIC_SUPABASE_URL,
    envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Cookie: cookieHeader,
        },
      },
    }
  );

  return client;
}

/**
 * Get the authenticated user from the server-side session
 * Returns null if not authenticated
 */
export async function getServerSession() {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the authenticated user from the server-side session using a request
 * Supports Authorization bearer token header and cookies.
 */
export async function getServerSessionFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.replace(/bearer\s+/i, '')
      : null;

  if (bearerToken) {
    const client = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
      }
    );
    
    // Use getUser to verify the token and get user info
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearerToken);
    
    if (error || !user) {
      console.error('[getServerSessionFromRequest] Error verifying token:', error?.message);
      return null;
    }
    
    // Construct a minimal session object from the token
    return {
      access_token: bearerToken,
      refresh_token: '', // Not available from header, but not needed for server-side
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Default 1 hour
      expires_in: 3600,
      token_type: 'bearer',
      user,
    } as any;
  }
  
  // For cookie-based session, use the request's cookies
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    console.warn('[getServerSessionFromRequest] No Authorization header or cookies found on request');
    return null;
  }
  
  const supabase = await getSupabaseFromRequest(request);
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('[getServerSessionFromRequest] Error getting session from cookies:', error.message);
    return null;
  }
  
  if (!session) {
    console.warn('[getServerSessionFromRequest] No session found in cookies');
    return null;
  }
  
  return session;
}

/**
 * Get the authenticated user ID from the server-side session
 * Returns null if not authenticated
 */
export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function getServerUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const session = await getServerSessionFromRequest(request);
  return session?.user?.id ?? null;
}

