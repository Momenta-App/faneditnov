'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  useEffect(() => {
    const initializeReset = async () => {
      // Step 1: Check if hash contains recovery token (before Supabase auto-processes it)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // Step 2: Also check if Supabase has already processed the hash and set a session
      // This happens because detectSessionInUrl: true in supabase-client.ts
      const { data: { session: existingSession } } = await supabaseClient.auth.getSession();
      
      // If we have a recovery token in the hash
      if (accessToken && type === 'recovery') {
        console.log('Found recovery token in URL hash');
        
        // Clean up URL hash for security (do this after extracting token)
        window.history.replaceState(null, '', window.location.pathname);
        
        // Set the session with the recovery token
        const { data, error: sessionError } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: '', // Not needed for recovery flow
        });
        
        if (sessionError || !data.session) {
          console.error('Error setting recovery session:', sessionError);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setToken(null);
          setIsCheckingToken(false);
          return;
        }
        
        // Token is valid, session is set
        console.log('Recovery token validated successfully');
        setToken(data.session.access_token);
        setIsCheckingToken(false);
      } 
      // If Supabase already processed the hash and set a session
      else if (existingSession?.access_token) {
        console.log('Found existing session (Supabase auto-processed hash)');
        // Supabase may have already processed the hash, so we have a valid session
        setToken(existingSession.access_token);
        setIsCheckingToken(false);
      }
      // No hash and no session - wait a bit for Supabase to process
      else {
        console.log('No token or session found, waiting for Supabase to process...');
        // Wait for Supabase to potentially process the hash
        // Supabase's detectSessionInUrl might still be processing
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabaseClient.auth.getSession();
          if (retrySession?.access_token) {
            console.log('Session found after wait');
            setToken(retrySession.access_token);
          } else {
            // Check hash one more time (in case it was just set)
            const currentHash = new URLSearchParams(window.location.hash.substring(1));
            const currentToken = currentHash.get('access_token');
            const currentType = currentHash.get('type');
            
            if (currentToken && currentType === 'recovery') {
              console.log('Found token after wait, processing now');
              window.history.replaceState(null, '', window.location.pathname);
              
              const { data, error } = await supabaseClient.auth.setSession({
                access_token: currentToken,
                refresh_token: '',
              });
              
              if (!error && data.session) {
                setToken(data.session.access_token);
                setIsCheckingToken(false);
                return;
              }
            }
            
            // Only show error if we've confirmed there's no valid session or token
            console.error('No valid recovery session found');
            console.error('Debug info:', {
              hasHash: !!window.location.hash,
              hashLength: window.location.hash.length,
              existingSession: !!existingSession,
            });
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
          setIsCheckingToken(false);
        }, 1000); // Increased wait time for Supabase to process
      }
    };

    // Small delay to ensure page is fully loaded and Supabase client is ready
    const timer = setTimeout(() => {
      initializeReset();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Get values directly from form elements to handle browser autofill
    const formData = new FormData(e.currentTarget);
    const passwordValue = (formData.get('password') as string) || password;
    const confirmPasswordValue = (formData.get('confirmPassword') as string) || confirmPassword;

    // Update state with the form values in case they were autofilled
    if (passwordValue && !password) setPassword(passwordValue);
    if (confirmPasswordValue && !confirmPassword) setConfirmPassword(confirmPasswordValue);

    // Validate passwords match
    if (passwordValue !== confirmPasswordValue) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (passwordValue.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      // Verify we have a valid session (should be set from the recovery token)
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Invalid or expired reset link. Please request a new password reset.');
      }

      // Update password using Supabase client
      // The session is already set from the recovery token in useEffect
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: passwordValue,
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to reset password');
      }

      // Success - show confirmation and redirect to login
      setSuccess(true);
      
      // Sign out to clear any temporary session
      await supabaseClient.auth.signOut();

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/auth/login?reset=success');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
      setIsLoading(false);
    }
  };

  // Only show error screen if we've finished checking and confirmed there's no valid token/session
  if (!isCheckingToken && !token && !success && error?.includes('Invalid')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
            <div className="text-center space-y-4">
              <Link
                href="/auth/forgot-password"
                className="inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Request a new password reset
              </Link>
              <div>
                <Link
                  href="/auth/login"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Set new password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          {success ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                Password reset successfully! Redirecting to login...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="New password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="••••••••"
              />

              <Input
                label="Confirm new password"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="••••••••"
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || isCheckingToken}
                className="w-full"
                isLoading={isLoading || isCheckingToken}
              >
                {isLoading ? 'Resetting password...' : isCheckingToken ? 'Validating link...' : 'Reset password'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

