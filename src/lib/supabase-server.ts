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

  // Fallback to cookie-based session
  return getSupabaseServer();
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
 * Supports Authorization bearer token header.
 */
export async function getServerSessionFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Extract token and verify it directly
    const token = authHeader.replace('Bearer ', '');
    
    // Create a temporary client to verify the token
    const client = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
      }
    );
    
    // Use getUser to verify the token and get user info
    const { data: { user }, error } = await client.auth.getUser(token);
    
    if (error || !user) {
      console.error('Error verifying token:', error);
      return null;
    }
    
    // Construct a minimal session object from the token
    return {
      access_token: token,
      refresh_token: '', // Not available from header, but not needed for server-side
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Default 1 hour
      expires_in: 3600,
      token_type: 'bearer',
      user,
    } as any;
  }
  
  // Fallback to cookie-based
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
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

