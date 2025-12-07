import { NextRequest, NextResponse } from 'next/server';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { StreamTester } from '@/lib/iptv/stream-tester';
import type { StreamTestResult } from '@/lib/types';

const tester = new StreamTester();
const processor = new SourceProcessor();

function calculateQualityScore(result: StreamTestResult): number {
  if (result.status === 'failure') {
    return 0;
  }

  // Use actual bitrate directly, scaled to 0-100 (assuming 10000 Kbps = 100%)
  if (result.bitrateKbps > 0) {
    return Math.min(100, Math.round((result.bitrateKbps / 10000) * 100));
  }

  return 0;
}

/**
 * Manual/webhook-triggered stream testing endpoint.
 * This endpoint is now primarily triggered by webhooks when repositories are updated.
 * It can also be called manually for testing purposes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const sourceParam = searchParams.get('source');
  const limit = limitParam ? Number(limitParam) : 50;

  // Get channels - either all or filtered by source
  const channels = sourceParam
    ? await processor.getChannelsBySource(sourceParam)
    : await processor.getAllChannels();

  // Prioritize untested channels, then inactive, then active (for re-testing)
  const sortedChannels = channels.sort(function prioritize(a, b) {
    if (a.status === 'untested' && b.status !== 'untested') return -1;
    if (a.status !== 'untested' && b.status === 'untested') return 1;
    if (a.status === 'inactive' && b.status === 'active') return -1;
    if (a.status === 'active' && b.status === 'inactive') return 1;
    // For same status, prefer channels that haven't been tested recently
    const aTested = a.lastTested ? new Date(a.lastTested).getTime() : 0;
    const bTested = b.lastTested ? new Date(b.lastTested).getTime() : 0;
    return aTested - bTested;
  });

  const targetChannels = sortedChannels.slice(0, limit);
  let tested = 0;
  let active = 0;
  let inactive = 0;

  for (const channel of targetChannels) {
    try {
      const result = await tester.testChannel(channel);
      await processor.saveTestResult(result);
      const isActive = result.status === 'success';
      if (isActive) {
        active += 1;
      } else {
        inactive += 1;
      }
      await processor.patchChannel(channel.id, {
        status: isActive ? 'active' : 'inactive',
        lastTested: result.testedAt,
        qualityScore: calculateQualityScore(result),
      });
      await processor.saveQualityMetrics(channel.id, calculateQualityMetrics([result]));
      tested += 1;
    } catch (error) {
      console.error(`Failed to test channel ${channel.id}:`, error);
      // Mark as inactive on error
      await processor.patchChannel(channel.id, {
        status: 'inactive',
        lastTested: new Date().toISOString(),
      });
      tested += 1;
      inactive += 1;
    }
  }

  return NextResponse.json({
    tested,
    active,
    inactive,
    source: sourceParam || 'all',
    timestamp: new Date().toISOString(),
  });
}

