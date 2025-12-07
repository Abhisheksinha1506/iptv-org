-- IPTV Fusion Hub - Initial Database Schema

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  logo TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  quality_score INTEGER DEFAULT 0,
  last_tested TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'untested')),
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(source);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category);
CREATE INDEX IF NOT EXISTS idx_channels_country ON channels(country);
CREATE INDEX IF NOT EXISTS idx_channels_quality_score ON channels(quality_score);

-- Test results table
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  response_time_ms INTEGER NOT NULL,
  bitrate_kbps INTEGER NOT NULL,
  resolution TEXT NOT NULL,
  tested_at TIMESTAMP NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for test_results
CREATE INDEX IF NOT EXISTS idx_test_results_channel_id ON test_results(channel_id);
CREATE INDEX IF NOT EXISTS idx_test_results_tested_at ON test_results(tested_at);

-- Quality metrics table
CREATE TABLE IF NOT EXISTS quality_metrics (
  channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  uptime_percentage NUMERIC NOT NULL,
  stability_score NUMERIC NOT NULL,
  video_quality_score NUMERIC NOT NULL,
  geo_availability_score NUMERIC NOT NULL,
  overall_score INTEGER NOT NULL,
  calculated_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  paths JSONB NOT NULL,
  last_commit_sha TEXT,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Repository updates queue table
CREATE TABLE IF NOT EXISTS repository_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  message TEXT NOT NULL,
  channels_added INTEGER NOT NULL DEFAULT 0,
  channels_updated INTEGER NOT NULL DEFAULT 0,
  channels_removed INTEGER NOT NULL DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for repository_updates
CREATE INDEX IF NOT EXISTS idx_repository_updates_processed ON repository_updates(processed);
CREATE INDEX IF NOT EXISTS idx_repository_updates_timestamp ON repository_updates(timestamp);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
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

