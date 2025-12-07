import { NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';
import { parseM3U } from '@/lib/iptv/m3u-parser';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { StreamTester } from '@/lib/iptv/stream-tester';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import { supabase } from '@/lib/supabase';
import type { Channel, StreamTestResult } from '@/lib/types';

const tracker = new RepositoryTracker();
const processor = new SourceProcessor();
const tester = new StreamTester();

function calculateQualityScore(result: StreamTestResult): number {
  if (result.status === 'failure') {
    return 0;
  }
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

  const sortedChannels = channels.sort(function prioritize(a, b) {
    if (a.status === 'untested' && b.status !== 'untested') return -1;
    if (a.status !== 'untested' && b.status === 'untested') return 1;
    if (a.status === 'inactive' && b.status === 'active') return -1;
    if (a.status === 'active' && b.status === 'inactive') return 1;
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
 * Manual database population endpoint
 * 
 * This endpoint:
 * 1. Validates all required tables exist
 * 2. Initializes repositories if needed
 * 3. Fetches all repositories (force fetch)
 * 4. Parses and saves channels
 * 5. Tests channels (up to 100 per repository)
 * 6. Calculates quality metrics
 * 
 * Can be called manually from the UI to populate the database
 */
export async function POST() {
  try {
    // Step 0: Validate all required tables exist
    const REQUIRED_TABLES = ['repositories', 'channels', 'test_results', 'quality_metrics', 'repository_updates'];
    const missingTables: string[] = [];

    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && (error.code === 'PGRST205' || error.message.includes('does not exist') || error.message.includes('relation'))) {
          missingTables.push(table);
        }
      } catch {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required database tables',
          missingTables,
          message: `The following required tables are missing: ${missingTables.join(', ')}. Please run the database migration.`,
        },
        { status: 500 },
      );
    }

    // Step 1: Initialize repositories if needed
    let tracked = await tracker.loadTrackedRepositories();
    if (tracked.length === 0) {
      console.log('[Populate] No repositories found, initializing from config...');
      tracked = await tracker.initializeDefaultRepositories();
    }

    if (tracked.length === 0) {
      return NextResponse.json(
        {
          error: 'No repositories configured',
          message: 'No repositories found and unable to initialize from config. Please check your source-repositories.json file.',
        },
        { status: 400 },
      );
    }

    // Step 2: Fetch and process all repositories
    const results: Array<{
      repository: string;
      channelsProcessed: number;
      testResults: { tested: number; active: number; inactive: number };
    }> = [];

    for (const repository of tracked) {
      try {
        // Fetch files from repository
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

          // Test channels (limit to 100 per repository to avoid timeout)
          const testResults = await testChannelsForSource(repository.id, 100);

          results.push({
            repository: repository.id,
            channelsProcessed: channels.length,
            testResults,
          });
        } else {
          results.push({
            repository: repository.id,
            channelsProcessed: 0,
            testResults: { tested: 0, active: 0, inactive: 0 },
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
      success: true,
      message: 'Database populated successfully',
      repositoriesProcessed: results.length,
      totalChannelsProcessed: totalChannels,
      totalChannelsTested: totalTested,
      totalActiveChannels: totalActive,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error populating database:', error);
    return NextResponse.json(
      {
        error: 'Failed to populate database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Also allow GET for easy testing
export async function GET() {
  return POST();
}

