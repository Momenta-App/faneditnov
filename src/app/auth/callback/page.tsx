'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase-client';

/**
 * Auth Callback Content Component
 * Handles email verification callbacks from Supabase
 * This component processes tokens from URL hash or query params
 * and automatically logs the user in
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for token in URL hash (Supabase sends tokens in hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const errorParam = hashParams.get('error');
        
        // Also check query params (some flows use query params)
        const token = searchParams.get('token') || accessToken;
        const tokenType = searchParams.get('type') || type;
        const errorFromQuery = searchParams.get('error') || errorParam;
        
        // Handle errors
        if (errorFromQuery) {
          console.error('Auth callback error:', errorFromQuery);
          setError(errorFromQuery);
          setIsLoading(false);
          setTimeout(() => {
            router.push('/auth/login?error=' + encodeURIComponent(errorFromQuery));
          }, 2000);
          return;
        }
        
        // If we have tokens in the hash, process them
        if (accessToken && refreshToken) {
          console.log('Processing tokens from URL hash');
          
          // Set the session using the tokens
          const { data, error: sessionError } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            setError(sessionError.message);
            setIsLoading(false);
            setTimeout(() => {
              router.push('/auth/login?error=' + encodeURIComponent(sessionError.message));
            }, 2000);
            return;
          }
          
          if (!data.session) {
            console.error('No session after setting tokens');
            setError('Failed to create session');
            setIsLoading(false);
            setTimeout(() => {
              router.push('/auth/login?error=session_failed');
            }, 2000);
            return;
          }
          
          console.log('✅ Session established successfully:', data.user?.id);
          
          // Clean up URL hash for security
          window.history.replaceState(null, '', '/');
          
          // Wait a moment to ensure session is fully persisted
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Refresh the page to ensure session state is fully synced
          // This ensures all components (including AuthContext) pick up the new session
          window.location.href = '/';
          return;
        }
        
        // If we have a token in query params, try the API callback route
        if (token && tokenType) {
          console.log('Found token in query params, redirecting to API callback');
          // Redirect to API callback which handles server-side token exchange
          window.location.href = `/api/auth/callback?token=${encodeURIComponent(token)}&type=${encodeURIComponent(tokenType)}`;
          return;
        }
        
        // Check if Supabase already processed the hash and set a session
        // (This happens when detectSessionInUrl is true)
        // Wait a moment for Supabase to process the hash if it's present
        if (window.location.hash) {
          console.log('Waiting for Supabase to process URL hash...');
          // Give Supabase a moment to process the hash
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const { data: { session }, error: sessionCheckError } = await supabaseClient.auth.getSession();
        
        if (sessionCheckError) {
          console.error('Error checking session:', sessionCheckError);
          setError(sessionCheckError.message);
          setIsLoading(false);
          setTimeout(() => {
            router.push('/auth/login?error=' + encodeURIComponent(sessionCheckError.message));
          }, 2000);
          return;
        }
        
        if (session) {
          console.log('✅ Session found (Supabase auto-processed):', session.user?.id);
          // Clean up URL hash
          window.history.replaceState(null, '', '/');
          // Wait a moment to ensure session is fully established
          await new Promise(resolve => setTimeout(resolve, 300));
          // Redirect to home
          router.push('/');
          return;
        }
        
        // No token found and no session - redirect to login
        console.error('No token or session found');
        setError('No authentication token found');
        setIsLoading(false);
        setTimeout(() => {
          router.push('/auth/login?error=missing_token');
        }, 2000);
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setError(error?.message || 'An error occurred');
        setIsLoading(false);
        setTimeout(() => {
          router.push('/auth/login?error=callback_error');
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your email and signing you in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Auth Callback Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

