import { createClient } from "@supabase/supabase-js";
import { envServer } from "./env-server";

export const supabaseAdmin = createClient(
  envServer.NEXT_PUBLIC_SUPABASE_URL,
  envServer.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
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

