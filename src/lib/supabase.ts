import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
  );
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database types (matching our schema)
export interface Database {
  public: {
    Tables: {
      channels: {
        Row: {
          id: string;
          name: string;
          url: string;
          country: string;
          category: string;
          logo: string | null;
          tvg_id: string | null;
          tvg_name: string | null;
          quality_score: number;
          last_tested: string | null;
          status: 'active' | 'inactive' | 'untested';
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          url: string;
          country: string;
          category: string;
          logo?: string | null;
          tvg_id?: string | null;
          tvg_name?: string | null;
          quality_score?: number;
          last_tested?: string | null;
          status: 'active' | 'inactive' | 'untested';
          source: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          url?: string;
          country?: string;
          category?: string;
          logo?: string | null;
          tvg_id?: string | null;
          tvg_name?: string | null;
          quality_score?: number;
          last_tested?: string | null;
          status?: 'active' | 'inactive' | 'untested';
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_results: {
        Row: {
          id: string;
          channel_id: string;
          status: 'success' | 'failure';
          response_time_ms: number;
          bitrate_kbps: number;
          resolution: string;
          tested_at: string;
          region: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          status: 'success' | 'failure';
          response_time_ms: number;
          bitrate_kbps: number;
          resolution: string;
          tested_at: string;
          region: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          status?: 'success' | 'failure';
          response_time_ms?: number;
          bitrate_kbps?: number;
          resolution?: string;
          tested_at?: string;
          region?: string;
          created_at?: string;
        };
      };
      quality_metrics: {
        Row: {
          channel_id: string;
          uptime_percentage: number;
          stability_score: number;
          video_quality_score: number;
          geo_availability_score: number;
          overall_score: number;
          calculated_at: string;
          updated_at: string;
        };
        Insert: {
          channel_id: string;
          uptime_percentage: number;
          stability_score: number;
          video_quality_score: number;
          geo_availability_score: number;
          overall_score: number;
          calculated_at: string;
          updated_at?: string;
        };
        Update: {
          channel_id?: string;
          uptime_percentage?: number;
          stability_score?: number;
          video_quality_score?: number;
          geo_availability_score?: number;
          overall_score?: number;
          calculated_at?: string;
          updated_at?: string;
        };
      };
      repositories: {
        Row: {
          id: string;
          owner: string;
          repo: string;
          branch: string;
          paths: string[];
          last_commit_sha: string | null;
          last_checked: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner: string;
          repo: string;
          branch: string;
          paths: string[];
          last_commit_sha?: string | null;
          last_checked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner?: string;
          repo?: string;
          branch?: string;
          paths?: string[];
          last_commit_sha?: string | null;
          last_checked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      repository_updates: {
        Row: {
          id: string;
          repository: string;
          timestamp: string;
          message: string;
          channels_added: number;
          channels_updated: number;
          channels_removed: number;
          processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          repository: string;
          timestamp: string;
          message: string;
          channels_added?: number;
          channels_updated?: number;
          channels_removed?: number;
          processed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          repository?: string;
          timestamp?: string;
          message?: string;
          channels_added?: number;
          channels_updated?: number;
          channels_removed?: number;
          processed?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

