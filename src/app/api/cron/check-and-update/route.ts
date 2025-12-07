import { NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';
import { parseM3U } from '@/lib/iptv/m3u-parser';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { StreamTester } from '@/lib/iptv/stream-tester';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import type { Channel, StreamTestResult } from '@/lib/types';

const tracker = new RepositoryTracker();
const processor = new SourceProcessor();
const tester = new StreamTester();

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

async function testChannelsForSource(
  source: string,
  limit: number = 100,
): Promise<{ tested: number; active: number; inactive: number }> {
  const channels = await processor.getChannelsBySource(source);

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

  return { tested, active, inactive };
}

/**
 * Combined cron job that:
 * 1. Checks for repository updates
 * 2. Fetches and processes updated repositories
 * 3. Automatically tests channels from updated repositories
 * 
 * Runs every 12 hours via Vercel Cron
 */
export async function GET() {
  try {
    // Step 1: Check for repository updates
    const updatedRepositories = await tracker.checkForUpdates();
    
    if (updatedRepositories.length === 0) {
      return NextResponse.json({
        message: 'No repository updates detected',
        checkedAt: new Date().toISOString(),
      });
    }

    // Step 2: Process each updated repository
    const results: Array<{
      repository: string;
      channelsProcessed: number;
      testResults: { tested: number; active: number; inactive: number };
    }> = [];

    for (const repository of updatedRepositories) {
      try {
        // Fetch updated files
        const files = await tracker.fetchUpdatedFiles(repository);
        const channels: Channel[] = [];

        // Parse M3U files
        for (const filePath of Object.keys(files)) {
          if (filePath.endsWith('.m3u') || filePath.endsWith('.m3u8')) {
            const parsed = parseM3U(files[filePath], repository.id, filePath);
            channels.push(...parsed);
          }
        }

        if (channels.length > 0) {
          // Save channels
          await processor.saveChannels(repository.id, channels);

          // Step 3: Automatically test channels for this source (limit to 100 to avoid timeout)
          const testResults = await testChannelsForSource(repository.id, 100);

          results.push({
            repository: repository.id,
            channelsProcessed: channels.length,
            testResults,
          });
        }
      } catch (error) {
        console.error(`Error processing repository ${repository.id}:`, error);
        results.push({
          repository: repository.id,
          channelsProcessed: 0,
          testResults: { tested: 0, active: 0, inactive: 0 },
        });
      }
    }

    const totalChannels = results.reduce(function sum(sum, r) {
      return sum + r.channelsProcessed;
    }, 0);
    const totalTested = results.reduce(function sum(sum, r) {
      return sum + r.testResults.tested;
    }, 0);
    const totalActive = results.reduce(function sum(sum, r) {
      return sum + r.testResults.active;
    }, 0);

    return NextResponse.json({
      message: 'Repositories checked and processed',
      repositoriesChecked: updatedRepositories.length,
      repositoriesProcessed: results.length,
      totalChannelsProcessed: totalChannels,
      totalChannelsTested: totalTested,
      totalActiveChannels: totalActive,
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in check-and-update cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to check and update repositories',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

