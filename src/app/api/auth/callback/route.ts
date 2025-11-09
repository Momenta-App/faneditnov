import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { envClient } from '@/lib/env-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/callback
 * Handle email verification callback from Supabase
 * This route processes the token from the email verification link
 * and establishes a session for the user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract token and type from query params
    // Supabase sends these as query parameters in the callback URL
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Handle errors from Supabase
    if (error) {
      console.error('Auth callback error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }
    
    // If no token, redirect to login with error
    if (!token) {
      console.error('No token in auth callback');
      return NextResponse.redirect(
        new URL('/auth/login?error=missing_token', request.url)
      );
    }
    
    // Get cookies to pass to Supabase client
    const cookieStore = await cookies();
    
    // Create Supabase client with cookies
    const supabase = createClient(
      envClient.NEXT_PUBLIC_SUPABASE_URL,
      envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          headers: {
            Cookie: cookieStore.toString(),
          },
        },
      }
    );
    
    // Exchange the token for a session
    // For email verification, Supabase sends tokens that need to be verified
    // The token might be a token_hash or an actual access_token
    
    // Try verifyOtp first (for email verification tokens)
    if (type === 'email' || type === 'signup' || type === 'recovery') {
      const email = searchParams.get('email') || undefined;
      
      // Try verifyOtp with token_hash
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type === 'recovery' ? 'recovery' : 'email',
      });
      
      if (!verifyError && verifyData.session) {
        console.log('Session established via verifyOtp:', verifyData.user?.id);
        // Redirect to client-side callback page to handle session persistence
        return NextResponse.redirect(new URL('/auth/callback', request.url));
      }
      
      // If verifyOtp didn't work, the token might be in a different format
      // Continue to fallback methods below
      if (verifyError) {
        console.log('verifyOtp failed, trying alternative method:', verifyError.message);
      }
    }
    
    // Alternative: Try to exchange the token directly
    // Some Supabase flows send access tokens directly
    try {
      const { data: tokenData, error: tokenError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: searchParams.get('refresh_token') || '',
      });
      
      if (!tokenError && tokenData.session) {
        console.log('Session established via setSession:', tokenData.user?.id);
        // Redirect to home page
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (setSessionError) {
      console.log('setSession failed, trying getSession');
    }
    
    // Check if session was already established (by client-side processing)
    const { data, error: exchangeError } = await supabase.auth.getSession();
    
    if (!exchangeError && data.session) {
      console.log('Session already exists:', data.session.user?.id);
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // If all methods failed, redirect to client-side callback page
    // The client-side callback will handle tokens in URL hash
    console.log('No session established server-side, redirecting to client callback');
    return NextResponse.redirect(new URL('/auth/callback', request.url));
    
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent('internal_error')}`, request.url)
    );
  }
}

