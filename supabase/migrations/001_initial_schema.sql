-- IPTV Fusion Hub - Initial Database Schema
-- All tables are MANDATORY and required for the application to function properly

-- Drop existing tables if they exist (for clean migration)
-- WARNING: This will delete all existing data
DROP TABLE IF EXISTS repository_updates CASCADE;
DROP TABLE IF EXISTS quality_metrics CASCADE;
DROP TABLE IF EXISTS test_results CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS repositories CASCADE;

-- Repositories table (MANDATORY - Required for automated updates)
-- Must be created first as channels reference it via source field
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  paths JSONB NOT NULL,
  last_commit_sha TEXT,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT repositories_paths_check CHECK (jsonb_typeof(paths) = 'array')
);

-- Indexes for repositories
CREATE INDEX idx_repositories_owner_repo ON repositories(owner, repo);
CREATE INDEX idx_repositories_last_checked ON repositories(last_checked);

-- Channels table (MANDATORY - Core table for all channel data)
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  logo TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  quality_score INTEGER DEFAULT 0 NOT NULL,
  last_tested TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'untested')),
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT channels_quality_score_check CHECK (quality_score >= 0 AND quality_score <= 100),
  CONSTRAINT channels_url_check CHECK (url ~ '^https?://'),
  CONSTRAINT channels_country_check CHECK (char_length(country) = 2 OR country = 'unknown')
);

-- Indexes for channels
CREATE INDEX idx_channels_source ON channels(source);
CREATE INDEX idx_channels_status ON channels(status);
CREATE INDEX idx_channels_category ON channels(category);
CREATE INDEX idx_channels_country ON channels(country);
CREATE INDEX idx_channels_quality_score ON channels(quality_score);
CREATE INDEX idx_channels_url ON channels(url);

-- Test results table (MANDATORY - Required for quality tracking)
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  response_time_ms INTEGER NOT NULL,
  bitrate_kbps INTEGER NOT NULL,
  resolution TEXT NOT NULL,
  tested_at TIMESTAMP NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT test_results_response_time_check CHECK (response_time_ms >= 0),
  CONSTRAINT test_results_bitrate_check CHECK (bitrate_kbps >= 0),
  CONSTRAINT test_results_region_check CHECK (char_length(region) > 0)
);

-- Indexes for test_results
CREATE INDEX idx_test_results_channel_id ON test_results(channel_id);
CREATE INDEX idx_test_results_tested_at ON test_results(tested_at);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_channel_tested ON test_results(channel_id, tested_at DESC);

-- Quality metrics table (MANDATORY - Required for quality scoring)
CREATE TABLE quality_metrics (
  channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  uptime_percentage NUMERIC(5,2) NOT NULL,
  stability_score NUMERIC(5,2) NOT NULL,
  video_quality_score NUMERIC(5,2) NOT NULL,
  geo_availability_score NUMERIC(5,2) NOT NULL,
  overall_score INTEGER NOT NULL,
  calculated_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT quality_metrics_uptime_check CHECK (uptime_percentage >= 0 AND uptime_percentage <= 100),
  CONSTRAINT quality_metrics_stability_check CHECK (stability_score >= 0 AND stability_score <= 100),
  CONSTRAINT quality_metrics_video_check CHECK (video_quality_score >= 0 AND video_quality_score <= 100),
  CONSTRAINT quality_metrics_geo_check CHECK (geo_availability_score >= 0 AND geo_availability_score <= 100),
  CONSTRAINT quality_metrics_overall_check CHECK (overall_score >= 0 AND overall_score <= 100)
);

-- Indexes for quality_metrics
CREATE INDEX idx_quality_metrics_overall_score ON quality_metrics(overall_score DESC);
CREATE INDEX idx_quality_metrics_calculated_at ON quality_metrics(calculated_at DESC);

-- Repository updates table (MANDATORY - Required for audit trail and update tracking)
CREATE TABLE repository_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  message TEXT NOT NULL,
  channels_added INTEGER NOT NULL DEFAULT 0,
  channels_updated INTEGER NOT NULL DEFAULT 0,
  channels_removed INTEGER NOT NULL DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT repository_updates_channels_added_check CHECK (channels_added >= 0),
  CONSTRAINT repository_updates_channels_updated_check CHECK (channels_updated >= 0),
  CONSTRAINT repository_updates_channels_removed_check CHECK (channels_removed >= 0),
  CONSTRAINT repository_updates_message_check CHECK (char_length(message) > 0)
);

-- Indexes for repository_updates
CREATE INDEX idx_repository_updates_processed ON repository_updates(processed);
CREATE INDEX idx_repository_updates_timestamp ON repository_updates(timestamp DESC);
CREATE INDEX idx_repository_updates_repository ON repository_updates(repository, timestamp DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at (MANDATORY)
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
  BEFORE UPDATE ON repositories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quality_metrics_updated_at
  BEFORE UPDATE ON quality_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Validation function to check all required tables exist
CREATE OR REPLACE FUNCTION validate_required_tables()
RETURNS TABLE(table_name TEXT, table_exists BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 'repositories'::TEXT, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'repositories'
  )
  UNION ALL
  SELECT 'channels'::TEXT, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'channels'
  )
  UNION ALL
  SELECT 'test_results'::TEXT, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'test_results'
  )
  UNION ALL
  SELECT 'quality_metrics'::TEXT, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'quality_metrics'
  )
  UNION ALL
  SELECT 'repository_updates'::TEXT, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'repository_updates'
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment to document table requirements
COMMENT ON TABLE repositories IS 'MANDATORY: Tracks GitHub repositories containing IPTV channel lists. Required for automated updates.';
COMMENT ON TABLE channels IS 'MANDATORY: Core table storing all IPTV channel information. Application cannot function without this table.';
COMMENT ON TABLE test_results IS 'MANDATORY: Stores individual stream test results. Required for quality tracking and metrics calculation.';
COMMENT ON TABLE quality_metrics IS 'MANDATORY: Stores calculated quality metrics for each channel. Required for quality scoring and dashboard display.';
COMMENT ON TABLE repository_updates IS 'MANDATORY: Audit log of repository update operations. Required for update history and tracking changes.';

