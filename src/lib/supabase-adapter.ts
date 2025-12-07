import { supabase } from '@/lib/supabase';
import type {
  Channel,
  QualityMetrics,
  RepositoryUpdate,
  SourceMetadata,
  StreamTestResult,
} from '@/lib/types';
import type { TrackedRepository } from '@/lib/github';

// Channel operations
export async function getAllChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').order('quality_score', {
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to fetch channels: ${error.message}`);
  }

  return (data || []).map(function mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      country: row.country,
      category: row.category,
      logo: row.logo ?? undefined,
      tvgId: row.tvg_id ?? undefined,
      tvgName: row.tvg_name ?? undefined,
      qualityScore: row.quality_score,
      lastTested: row.last_tested ?? undefined,
      status: row.status as Channel['status'],
      source: row.source,
    };
  });
}

export async function getChannelsBySource(source: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('source', source)
    .order('quality_score', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch channels by source: ${error.message}`);
  }

  return (data || []).map(function mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      country: row.country,
      category: row.category,
      logo: row.logo ?? undefined,
      tvgId: row.tvg_id ?? undefined,
      tvgName: row.tvg_name ?? undefined,
      qualityScore: row.quality_score,
      lastTested: row.last_tested ?? undefined,
      status: row.status as Channel['status'],
      source: row.source,
    };
  });
}

export interface ChannelFilters {
  category?: string | null;
  country?: string | null;
  status?: string | null;
  source?: string | null;
}

export interface PaginatedChannelsResult {
  channels: Channel[];
  total: number;
}

function mapChannelRow(row: Record<string, unknown>): Channel {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    country: row.country as string,
    category: row.category as string,
    logo: (row.logo as string | null) ?? undefined,
    tvgId: (row.tvg_id as string | null) ?? undefined,
    tvgName: (row.tvg_name as string | null) ?? undefined,
    qualityScore: row.quality_score as number,
    lastTested: (row.last_tested as string | null) ?? undefined,
    status: row.status as Channel['status'],
    source: row.source as string,
  };
}

export async function getChannelsWithFilters(
  filters: ChannelFilters,
  limit: number,
  offset: number,
): Promise<PaginatedChannelsResult> {
  let query = supabase.from('channels').select('*', { count: 'exact' });

  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.country) {
    query = query.eq('country', filters.country);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.source) {
    query = query.eq('source', filters.source);
  }

  // Sort by quality_score first (database-level sorting)
  query = query.order('quality_score', { ascending: false });

  // Fetch all matching records to sort by status priority
  // Note: For very large datasets, we might want to optimize this further
  // but for typical use cases (filtered results), this is acceptable
  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch channels with filters: ${error.message}`);
  }

  const allChannels = (data || []).map(mapChannelRow);

  // Sort by status priority (active > inactive > untested), then quality_score
  const statusPriority: Record<string, number> = { active: 3, inactive: 2, untested: 1 };
  allChannels.sort(function prioritize(a, b) {
    const aPriority = statusPriority[a.status] || 0;
    const bPriority = statusPriority[b.status] || 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    return b.qualityScore - a.qualityScore;
  });

  // Apply pagination after sorting
  const channels = allChannels.slice(offset, offset + limit);

  return {
    channels,
    total: count || 0,
  };
}

export async function getChannelById(channelId: string): Promise<Channel | null> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch channel by ID: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapChannelRow(data);
}

export async function upsertChannel(channel: Channel): Promise<void> {
  const { error } = await supabase.from('channels').upsert(
    {
      id: channel.id,
      name: channel.name,
      url: channel.url,
      country: channel.country,
      category: channel.category,
      logo: channel.logo ?? null,
      tvg_id: channel.tvgId ?? null,
      tvg_name: channel.tvgName ?? null,
      quality_score: channel.qualityScore,
      last_tested: channel.lastTested ?? null,
      status: channel.status,
      source: channel.source,
    },
    {
      onConflict: 'id',
    },
  );

  if (error) {
    throw new Error(`Failed to upsert channel: ${error.message}`);
  }
}

export async function updateChannel(
  channelId: string,
  updates: Partial<Channel>,
): Promise<Channel | null> {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.url !== undefined) updateData.url = updates.url;
  if (updates.country !== undefined) updateData.country = updates.country;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.logo !== undefined) updateData.logo = updates.logo ?? null;
  if (updates.tvgId !== undefined) updateData.tvg_id = updates.tvgId ?? null;
  if (updates.tvgName !== undefined) updateData.tvg_name = updates.tvgName ?? null;
  if (updates.qualityScore !== undefined) updateData.quality_score = updates.qualityScore;
  if (updates.lastTested !== undefined) updateData.last_tested = updates.lastTested ?? null;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.source !== undefined) updateData.source = updates.source;

  const { data, error } = await supabase
    .from('channels')
    .update(updateData)
    .eq('id', channelId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to update channel: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    url: data.url,
    country: data.country,
    category: data.category,
    logo: data.logo ?? undefined,
    tvgId: data.tvg_id ?? undefined,
    tvgName: data.tvg_name ?? undefined,
    qualityScore: data.quality_score,
    lastTested: data.last_tested ?? undefined,
    status: data.status as Channel['status'],
    source: data.source,
  };
}

// Test results operations
export async function saveTestResult(result: StreamTestResult): Promise<void> {
  const { error } = await supabase.from('test_results').insert({
    channel_id: result.channelId,
    status: result.status,
    response_time_ms: result.responseTimeMs,
    bitrate_kbps: result.bitrateKbps,
    resolution: result.resolution,
    tested_at: result.testedAt,
    region: result.region,
  });

  if (error) {
    throw new Error(`Failed to save test result: ${error.message}`);
  }
}

export async function getTestResults(channelId: string): Promise<StreamTestResult[]> {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('channel_id', channelId)
    .order('tested_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch test results: ${error.message}`);
  }

  return (data || []).map(function mapRow(row) {
    return {
      channelId: row.channel_id,
      status: row.status as 'success' | 'failure',
      responseTimeMs: row.response_time_ms,
      bitrateKbps: row.bitrate_kbps,
      resolution: row.resolution,
      testedAt: row.tested_at,
      region: row.region,
    };
  });
}

export interface LatestTestResult {
  channelId: string;
  status: 'success' | 'failure';
  responseTimeMs: number;
  bitrateKbps: number;
  resolution: string;
  testedAt: string;
  region: string;
}

export async function getTestResultsBatch(
  channelIds: string[],
): Promise<Map<string, LatestTestResult>> {
  if (channelIds.length === 0) {
    return new Map();
  }

  // Fetch all test results for the given channel IDs, ordered by tested_at descending
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .in('channel_id', channelIds)
    .order('tested_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch batch test results: ${error.message}`);
  }

  // Group by channel_id and take the latest (first) result for each channel
  const resultMap = new Map<string, LatestTestResult>();
  const seenChannels = new Set<string>();

  for (const row of data || []) {
    const channelId = row.channel_id as string;
    if (!seenChannels.has(channelId)) {
      seenChannels.add(channelId);
      resultMap.set(channelId, {
        channelId,
        status: row.status as 'success' | 'failure',
        responseTimeMs: row.response_time_ms,
        bitrateKbps: row.bitrate_kbps,
        resolution: row.resolution,
        testedAt: row.tested_at,
        region: row.region,
      });
    }
  }

  return resultMap;
}

// Quality metrics operations
export async function saveQualityMetrics(
  channelId: string,
  metrics: QualityMetrics,
): Promise<void> {
  const { error } = await supabase.from('quality_metrics').upsert(
    {
      channel_id: channelId,
      uptime_percentage: metrics.uptimePercentage,
      stability_score: metrics.stabilityScore,
      video_quality_score: metrics.videoQualityScore,
      geo_availability_score: metrics.geoAvailabilityScore,
      overall_score: metrics.overallScore,
      calculated_at: metrics.calculatedAt,
    },
    {
      onConflict: 'channel_id',
    },
  );

  if (error) {
    throw new Error(`Failed to save quality metrics: ${error.message}`);
  }
}

export async function getQualityMetrics(channelId: string): Promise<QualityMetrics | null> {
  const { data, error } = await supabase
    .from('quality_metrics')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch quality metrics: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    uptimePercentage: data.uptime_percentage,
    stabilityScore: data.stability_score,
    videoQualityScore: data.video_quality_score,
    geoAvailabilityScore: data.geo_availability_score,
    overallScore: data.overall_score,
    calculatedAt: data.calculated_at,
  };
}

export async function getQualityMetricsBatch(
  channelIds: string[],
): Promise<Map<string, QualityMetrics>> {
  if (channelIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('quality_metrics')
    .select('*')
    .in('channel_id', channelIds);

  if (error) {
    throw new Error(`Failed to fetch batch quality metrics: ${error.message}`);
  }

  const resultMap = new Map<string, QualityMetrics>();

  for (const row of data || []) {
    const channelId = row.channel_id as string;
    resultMap.set(channelId, {
      uptimePercentage: row.uptime_percentage,
      stabilityScore: row.stability_score,
      videoQualityScore: row.video_quality_score,
      geoAvailabilityScore: row.geo_availability_score,
      overallScore: row.overall_score,
      calculatedAt: row.calculated_at,
    });
  }

  return resultMap;
}

// Repository operations
export async function loadTrackedRepositories(): Promise<TrackedRepository[]> {
  const { data, error } = await supabase.from('repositories').select('*');

  if (error) {
    throw new Error(`Failed to load tracked repositories: ${error.message}`);
  }

  return (data || []).map(function mapRow(row) {
    return {
      id: row.id,
      owner: row.owner,
      repo: row.repo,
      branch: row.branch,
      paths: row.paths as string[],
      lastCommitSha: row.last_commit_sha ?? undefined,
      lastChecked: row.last_checked ?? undefined,
    };
  });
}

export async function upsertRepository(repository: TrackedRepository): Promise<void> {
  const { error } = await supabase.from('repositories').upsert(
    {
      id: repository.id,
      owner: repository.owner,
      repo: repository.repo,
      branch: repository.branch,
      paths: repository.paths,
      last_commit_sha: repository.lastCommitSha ?? null,
      last_checked: repository.lastChecked ?? null,
    },
    {
      onConflict: 'id',
    },
  );

  if (error) {
    throw new Error(`Failed to upsert repository: ${error.message}`);
  }
}

export async function getRepositoryById(id: string): Promise<TrackedRepository | null> {
  const { data, error } = await supabase.from('repositories').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch repository: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    owner: data.owner,
    repo: data.repo,
    branch: data.branch,
    paths: data.paths as string[],
    lastCommitSha: data.last_commit_sha ?? undefined,
    lastChecked: data.last_checked ?? undefined,
  };
}

// Repository updates operations
export async function appendRepositoryUpdate(update: RepositoryUpdate): Promise<void> {
  const { error } = await supabase.from('repository_updates').insert({
    repository: update.repository,
    timestamp: update.timestamp,
    message: update.message,
    channels_added: update.channelsAdded,
    channels_updated: update.channelsUpdated,
    channels_removed: update.channelsRemoved,
    processed: false,
  });

  if (error) {
    throw new Error(`Failed to append repository update: ${error.message}`);
  }
}

export async function getUnprocessedRepositoryUpdates(): Promise<RepositoryUpdate[]> {
  const { data, error } = await supabase
    .from('repository_updates')
    .select('*')
    .eq('processed', false)
    .order('timestamp', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch repository updates: ${error.message}`);
  }

  return (data || []).map(function mapRow(row) {
    return {
      repository: row.repository,
      timestamp: row.timestamp,
      message: row.message,
      channelsAdded: row.channels_added,
      channelsUpdated: row.channels_updated,
      channelsRemoved: row.channels_removed,
    };
  });
}

export async function markRepositoryUpdatesAsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('repository_updates')
    .update({ processed: true })
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to mark updates as processed: ${error.message}`);
  }
}

// Source metadata operations (for backward compatibility)
export async function saveSourceMetadata(source: string, count: number): Promise<void> {
  // This is now tracked via repository_updates, but we keep this for compatibility
  // We can also track it in a separate table if needed, but for now we'll just log it
  console.log(`Source metadata: ${source} has ${count} channels`);
}

export async function getSourceMetadata(source: string): Promise<SourceMetadata | null> {
  // Get the latest update for this source
  const { data, error } = await supabase
    .from('repository_updates')
    .select('*')
    .eq('repository', source)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // Fallback: count channels for this source
    const channels = await getChannelsBySource(source);
    return {
      lastUpdate: new Date().toISOString(),
      channelCount: channels.length,
    };
  }

  const channels = await getChannelsBySource(source);
  return {
    lastUpdate: data.timestamp,
    channelCount: channels.length,
  };
}

