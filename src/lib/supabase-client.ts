/**
 * Client-side Supabase client for authentication
 * Use this in client components for auth operations
 */
import { createClient } from '@supabase/supabase-js';
import { envClient } from './env-client';

export const supabaseClient = createClient(
  envClient.NEXT_PUBLIC_SUPABASE_URL,
  envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

