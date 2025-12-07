import { NextRequest, NextResponse } from 'next/server';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import {
  getChannelsWithFilters,
  getTestResultsBatch,
  getQualityMetricsBatch,
  type ChannelFilters,
} from '@/lib/supabase-adapter';
import type { Channel } from '@/lib/types';

const processor = new SourceProcessor();

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600;

export interface ChannelWithMetrics extends Channel {
  latestBitrate?: number;
  latestResolution?: string;
  latestResponseTime?: number;
  uptimePercentage?: number;
}

async function enrichChannelsBatch(
  channels: Channel[],
): Promise<ChannelWithMetrics[]> {
  if (channels.length === 0) {
    return [];
  }

  const channelIds = channels.map(function getIds(channel) {
    return channel.id;
  });

  // Batch fetch test results and quality metrics
  const [testResultsMap, qualityMetricsMap] = await Promise.all([
    getTestResultsBatch(channelIds),
    getQualityMetricsBatch(channelIds),
  ]);

  // Enrich channels with batch-fetched data
  return channels.map(function enrich(channel) {
    const enriched: ChannelWithMetrics = { ...channel };

    const latestTestResult = testResultsMap.get(channel.id);
    if (latestTestResult) {
      enriched.latestBitrate = latestTestResult.bitrateKbps;
      enriched.latestResolution = latestTestResult.resolution;
      enriched.latestResponseTime = latestTestResult.responseTimeMs;
    }

    const qualityMetrics = qualityMetricsMap.get(channel.id);
    if (qualityMetrics) {
      enriched.uptimePercentage = qualityMetrics.uptimePercentage;
    }

    return enriched;
  });
}

function validateChannelPayload(payload: Partial<Channel>): payload is Channel {
  return Boolean(payload.id && payload.name && payload.url && payload.source && payload.category);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const country = searchParams.get('country');
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  // Build filters object
  const filters: ChannelFilters = {
    category: category || null,
    country: country || null,
    status: status || null,
    source: source || null,
  };

  // Fetch channels with database-level filtering and pagination
  const { channels, total } = await getChannelsWithFilters(filters, limit, offset);

  // Enrich channels with metrics using batch queries
  const enrichedChannels = await enrichChannelsBatch(channels);

  const response = NextResponse.json({
    channels: enrichedChannels,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  });
  response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const source = body?.source as string;
  const items = body?.channels as Channel[];

  if (!source || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const validChannels: Channel[] = [];
  for (const item of items) {
    if (!validateChannelPayload(item)) {
      return NextResponse.json({ error: 'Invalid channel entry' }, { status: 422 });
    }
    validChannels.push(item);
  }

  await processor.saveChannels(source, validChannels);
  return NextResponse.json({ success: true, count: validChannels.length });
}

