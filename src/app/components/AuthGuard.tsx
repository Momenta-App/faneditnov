'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase-client';

/**
 * AuthGuard component that shows loading state while checking auth
 * and redirects to login if not authenticated
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect if we're on login or signup pages
    if (pathname === '/auth/login' || pathname === '/auth/signup' || pathname === '/auth/callback') {
      return;
    }

    // Only redirect if we've finished loading and definitely don't have a user
    // Give extra time for session to load from Supabase
    if (!isLoading && !user) {
      // Wait a bit longer and try to refresh session once before redirecting
      const timer = setTimeout(async () => {
        // Try to refresh session one more time
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.user) {
            // Session found, don't redirect
            return;
          }
        } catch (err) {
          console.error('Error checking session:', err);
        }
        
        // Still no user after refresh, redirect to login
        router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      }, 1000); // Give 1 second for session to load
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, router, pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // If still loading, show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // If not authenticated and not on login/signup page, show loading while redirect happens
  if (!user && pathname !== '/auth/login' && pathname !== '/auth/signup' && pathname !== '/auth/callback') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  // User is authenticated or on login/signup page, show content
  return <>{children}</>;
}

