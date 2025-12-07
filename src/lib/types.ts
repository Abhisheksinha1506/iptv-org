export type StreamStatus = 'active' | 'inactive' | 'untested';

export interface Channel {
  id: string;
  name: string;
  url: string;
  country: string;
  category: string;
  logo?: string;
  tvgId?: string;
  tvgName?: string;
  qualityScore: number;
  lastTested?: string;
  status: StreamStatus;
  source: string;
}

export interface SourceMetadata {
  lastUpdate: string;
  channelCount: number;
}

export interface QualityMetrics {
  uptimePercentage: number;
  stabilityScore: number;
  videoQualityScore: number;
  geoAvailabilityScore: number;
  overallScore: number;
  calculatedAt: string;
}

export interface StreamTestResult {
  channelId: string;
  status: 'success' | 'failure';
  responseTimeMs: number;
  bitrateKbps: number;
  resolution: string;
  testedAt: string;
  region: string;
}

export interface RepositoryUpdate {
  repository: string;
  timestamp: string;
  message: string;
  channelsAdded: number;
  channelsUpdated: number;
  channelsRemoved: number;
}

