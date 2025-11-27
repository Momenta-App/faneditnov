import { createClient } from "@supabase/supabase-js";
import type { NextFetchRequestConfig } from "next/server";
import { envServer } from "./env-server";

// Verify service role key is present (but don't log it)
if (!envServer.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

if (!envServer.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

// Verify the key looks like a service role key (starts with eyJ)
const isServiceRoleKey = envServer.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ');
if (!isServiceRoleKey) {
  console.warn('[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY does not appear to be a valid JWT token');
}

type NextRequestInit = RequestInit & { next?: Pick<NextFetchRequestConfig, 'revalidate'> };

const baseFetch = globalThis.fetch?.bind(globalThis);

const noStoreFetch: typeof fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const requestInit: NextRequestInit = {
    cache: 'no-store',
    ...init,
  };

  // Ensure Next.js cache is also bypassed
  requestInit.next = { revalidate: 0, ...(init as NextRequestInit).next };

  // Preserve existing headers but make sure we clone to avoid mutation
  if (init?.headers) {
    requestInit.headers = new Headers(init.headers as HeadersInit);
  }

  if (!baseFetch) {
    throw new Error('Fetch API is not available in the current runtime environment');
  }

  return baseFetch(input as RequestInfo, requestInit);
};

export const supabaseAdmin = createClient(
  envServer.NEXT_PUBLIC_SUPABASE_URL,
  envServer.SUPABASE_SERVICE_ROLE_KEY,
  { 
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  }
);

// Log client initialization (URL only, never the key)
console.log('[Supabase Admin] Client initialized with URL:', envServer.NEXT_PUBLIC_SUPABASE_URL);
console.log('[Supabase Admin] Service role key present:', !!envServer.SUPABASE_SERVICE_ROLE_KEY);
console.log('[Supabase Admin] Service role key format valid:', isServiceRoleKey);

export const STORAGE_BUCKET = envServer.SUPABASE_STORAGE_BUCKET;

// Database types
export type Database = {
  public: {
    Tables: {
      bd_ingestions: {
        Row: {
          id: string;
          snapshot_id: string;
          dataset_id: string | null;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
          error: string | null;
          raw_count: number;
          processed_count: number;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          dataset_id?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          error?: string | null;
          raw_count?: number;
          processed_count?: number;
        };
        Update: {
          id?: string;
          snapshot_id?: string;
          dataset_id?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          error?: string | null;
          raw_count?: number;
          processed_count?: number;
        };
      };
      bd_raw_records: {
        Row: {
          id: string;
          snapshot_id: string;
          record_index: number;
          raw_data: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          record_index: number;
          raw_data: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_id?: string;
          record_index?: number;
          raw_data?: any;
          created_at?: string;
        };
      };
      tiktok_posts: {
        Row: {
          id: string;
          post_id: string;
          url: string | null;
          description: string | null;
          create_time: string | null;
          digg_count: number;
          comment_count: number;
          share_count: number;
          play_count: number;
          collect_count: number;
          duration_seconds: number | null;
          hashtags: string[];
          media: any | null;
          profile: any | null;
          music: any | null;
          tagged_user: any | null;
          subtitle_info: any | null;
          input_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          url?: string | null;
          description?: string | null;
          create_time?: string | null;
          digg_count?: number;
          comment_count?: number;
          share_count?: number;
          play_count?: number;
          collect_count?: number;
          duration_seconds?: number | null;
          hashtags?: string[];
          media?: any | null;
          profile?: any | null;
          music?: any | null;
          tagged_user?: any | null;
          subtitle_info?: any | null;
          input_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          url?: string | null;
          description?: string | null;
          create_time?: string | null;
          digg_count?: number;
          comment_count?: number;
          share_count?: number;
          play_count?: number;
          collect_count?: number;
          duration_seconds?: number | null;
          hashtags?: string[];
          media?: any | null;
          profile?: any | null;
          music?: any | null;
          tagged_user?: any | null;
          subtitle_info?: any | null;
          input_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      tiktok_posts_search: {
        Row: {
          id: string;
          post_id: string;
          url: string | null;
          description: string | null;
          create_time: string | null;
          digg_count: number;
          comment_count: number;
          share_count: number;
          play_count: number;
          collect_count: number;
          duration_seconds: number | null;
          hashtags: string[];
          username: string | null;
          nickname: string | null;
          video_url: string | null;
          cover_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      ingest_brightdata_snapshot: {
        Args: {
          p_snapshot_id: string;
          p_dataset_id: string;
          p_payload: any;
        };
        Returns: any;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

