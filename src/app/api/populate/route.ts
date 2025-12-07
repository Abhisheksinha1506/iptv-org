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

/**
 * Test channels and update them with test results and quality metrics
 * This happens BEFORE saving to database so all channels have proper status and scores
 * Returns both enriched channels and test results for saving
 */
async function testAndEnrichChannels(
  channels: Channel[],
): Promise<{
  tested: number;
  active: number;
  inactive: number;
  enrichedChannels: Channel[];
  testResults: StreamTestResult[];
  qualityMetrics: Array<{ channelId: string; metrics: ReturnType<typeof calculateQualityMetrics> }>;
}> {
  let tested = 0;
  let active = 0;
  let inactive = 0;
  const enrichedChannels: Channel[] = [];
  const testResults: StreamTestResult[] = [];
  const qualityMetrics: Array<{ channelId: string; metrics: ReturnType<typeof calculateQualityMetrics> }> = [];

  for (const channel of channels) {
    try {
      // Test the channel
      const result = await tester.testChannel(channel);
      const isActive = result.status === 'success';
      
      // Calculate quality score
      const qualityScore = calculateQualityScore(result);
      
      // Calculate quality metrics
      const metrics = calculateQualityMetrics([result]);
      
      // Store test result and metrics for later saving
      testResults.push(result);
      qualityMetrics.push({ channelId: channel.id, metrics });
      
      // Create enriched channel with test results
      const enrichedChannel: Channel = {
        ...channel,
        status: isActive ? 'active' : 'inactive',
        lastTested: result.testedAt,
        qualityScore,
      };
      
      enrichedChannels.push(enrichedChannel);
      
      if (isActive) {
        active += 1;
      } else {
        inactive += 1;
      }
      tested += 1;
    } catch (error) {
      console.error(`Failed to test channel ${channel.id}:`, error);
      // Mark as inactive on error
      const enrichedChannel: Channel = {
        ...channel,
        status: 'inactive',
        lastTested: new Date().toISOString(),
        qualityScore: 0,
      };
      enrichedChannels.push(enrichedChannel);
      tested += 1;
      inactive += 1;
    }
  }

  return { tested, active, inactive, enrichedChannels, testResults, qualityMetrics };
}

/**
 * Manual database population endpoint
 * 
 * This endpoint:
 * 1. Validates all required tables exist
 * 2. Initializes repositories if needed
 * 3. Fetches all repositories (force fetch)
 * 4. Parses channels from M3U files
 * 5. Saves channels immediately (to avoid timeout)
 * 6. Tests channels in batches (up to 50 per repository to avoid timeout)
 * 7. Updates channels with test results and quality metrics
 * 
 * Note: To avoid 504 timeouts, we save channels first, then test a limited batch.
 * Remaining channels can be tested later via the test-streams endpoint.
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
      testResults: { tested: number; active: number; inactive: number; note?: string };
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
          // Step 1: Save channels immediately (with untested status to avoid timeout)
          console.log(`[Populate] Saving ${channels.length} channels for ${repository.id}...`);
          await processor.saveChannels(repository.id, channels);

          // Step 2: Test a limited batch of channels (50 per repository to avoid timeout)
          // This ensures at least some channels have status and quality scores
          const testLimit = 50;
          const channelsToTest = channels.slice(0, testLimit);
          console.log(`[Populate] Testing ${channelsToTest.length} of ${channels.length} channels for ${repository.id}...`);
          
          const { tested, active, inactive, enrichedChannels, testResults, qualityMetrics } = await testAndEnrichChannels(channelsToTest);

          // Step 3: Update tested channels with their results
          for (let i = 0; i < enrichedChannels.length; i++) {
            try {
              const enrichedChannel = enrichedChannels[i];
              await processor.patchChannel(enrichedChannel.id, {
                status: enrichedChannel.status,
                qualityScore: enrichedChannel.qualityScore,
                lastTested: enrichedChannel.lastTested,
              });
            } catch (error) {
              console.error(`Failed to update channel ${enrichedChannels[i]?.id}:`, error);
            }
          }

          // Step 4: Save test results and quality metrics for tested channels
          console.log(`[Populate] Saving test results and quality metrics for ${repository.id}...`);
          for (let i = 0; i < testResults.length; i++) {
            try {
              const testResult = testResults[i];
              const { metrics } = qualityMetrics[i];
              
              // Save test result
              await processor.saveTestResult(testResult);
              
              // Save quality metrics
              await processor.saveQualityMetrics(testResult.channelId, metrics);
            } catch (error) {
              console.error(`Failed to save test data for channel ${testResults[i]?.channelId}:`, error);
              // Continue with other channels
            }
          }

          results.push({
            repository: repository.id,
            channelsProcessed: channels.length,
            testResults: { 
              tested, 
              active, 
              inactive,
              note: channels.length > testLimit ? `${channels.length - testLimit} channels saved but not yet tested (use test-streams endpoint to test remaining)` : undefined,
            },
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

