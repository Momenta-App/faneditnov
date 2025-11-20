'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { envClient } from '@/lib/env-client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/app/types/data';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: any | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    loadSession();

    // Listen to auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user && session?.access_token) {
          // Fetch profile when session changes, using the session's access token directly
          await fetchProfileWithToken(session.user.id, session.access_token);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchProfile is stable, no need to include it

  const loadSession = async () => {
    try {
      // Get session from Supabase - this reads from localStorage/cookies
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setSession(null);
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfileWithToken = async (userId: string, accessToken: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      if (!accessToken) {
        console.warn('No access token provided for profile fetch');
        setProfile(null);
        return;
      }

      console.log('Calling /api/auth/session with token');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout (reduced from 10)
      
      try {
        const response = await fetch('/api/auth/session', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
          // Add cache control to prevent stale requests
          cache: 'no-store',
        });
        
        clearTimeout(timeoutId);
        
        // Don't throw on non-ok responses, just handle gracefully
        if (!response.ok) {
          console.warn('Session API returned non-ok status:', response.status);
          const errorData = await response.json().catch(() => ({}));
          setProfile(null);
          return;
        }

        const data = await response.json();
        console.log('Profile fetch result:', { 
          hasProfile: !!data.profile, 
          hasUser: !!data.user,
          userId,
          profileData: data.profile,
        });
        
        if (data.profile) {
          setProfile(data.profile);
          console.log('✅ Profile set successfully');
        } else {
          // Profile might not exist yet, that's okay
          setProfile(null);
          console.warn('⚠️ Profile not found for user:', userId);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('❌ Profile fetch timed out after 10 seconds');
        } else {
          throw fetchError;
        }
        setProfile(null);
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      setProfile(null);
    }
  };

  // Legacy function for backwards compatibility - uses getSession which might hang
  const fetchProfile = async (userId: string) => {
    console.log('⚠️ fetchProfile called without token, getting session first...');
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.warn('No access token available');
        setProfile(null);
        return;
      }
      
      await fetchProfileWithToken(userId, accessToken);
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
      setProfile(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Debug logging
      console.log('🔐 signIn called with:', { 
        email: email || '(empty)', 
        emailType: typeof email,
        password: password ? '(provided)' : '(empty)', 
        passwordType: typeof password,
        emailLength: email?.length || 0,
        passwordLength: password?.length || 0
      });
      
      // Perform login entirely on client to ensure session persistence
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || 'Login failed');
      }

      if (!data.session || !data.user) {
        throw new Error('Failed to create session');
      }

      console.log('✅ Client login successful:', data.user.id);
      setSession(data.session);
      setUser(data.user);
      // onAuthStateChange will fetch the profile; no need to do it here
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Log the full error for debugging
        console.error('Signup API error:', {
          status: response.status,
          error: data.error,
          code: data.code,
          details: data.details,
          fullResponse: data,
        });
        
        // Show the most detailed error message available
        let errorMessage = data.error || 'Signup failed';
        if (data.details?.message) {
          errorMessage = data.details.message;
        } else if (data.details?.error) {
          errorMessage = data.details.error;
        }
        throw new Error(errorMessage);
      }

      // If Supabase requires email confirmation, session will be null
      // In that case, we need to wait for email confirmation
      if (data.session) {
        // User is auto-logged in (email confirmation disabled)
        console.log('Session available after signup, user auto-logged in');
        await refreshSession();
      } else {
        // Email confirmation required
        console.log('No session after signup - email confirmation required');
        // Clear any existing session state
        setUser(null);
        setProfile(null);
        // User should confirm email and then log in manually
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      await supabaseClient.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      // First get current session
      const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
      
      if (currentSession) {
        // If we have a session, refresh it
        const { data: { session }, error } = await supabaseClient.auth.refreshSession();
        if (error) throw error;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } else {
        // No session - try to fetch anyway in case one exists
        const { data: { session: newSession } } = await supabaseClient.auth.getSession();
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        }
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
