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
 * 
 * REQUIRES ALL TABLES:
 * - channels: Source of channels to test
 * - test_results: Destination for test results
 * - quality_metrics: Destination for calculated quality metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Validate required tables exist
    const { supabase } = await import('@/lib/supabase');
    const requiredTables = ['channels', 'test_results', 'quality_metrics'];
    const missingTables: string[] = [];

    for (const table of requiredTables) {
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

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const sourceParam = searchParams.get('source');
    const limit = limitParam ? Number(limitParam) : 50;

    // Get channels - either all or filtered by source (from channels table)
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
        // Test channel stream
        const result = await tester.testChannel(channel);
        
        // Save test result (to test_results table)
        await processor.saveTestResult(result);
        
        const isActive = result.status === 'success';
        if (isActive) {
          active += 1;
        } else {
          inactive += 1;
        }
        
        // Update channel status (in channels table)
        await processor.patchChannel(channel.id, {
          status: isActive ? 'active' : 'inactive',
          lastTested: result.testedAt,
          qualityScore: calculateQualityScore(result),
        });
        
        // Calculate and save quality metrics (to quality_metrics table)
        await processor.saveQualityMetrics(channel.id, calculateQualityMetrics([result]));
        tested += 1;
      } catch (error) {
        console.error(`Failed to test channel ${channel.id}:`, error);
        // Mark as inactive on error (update channels table)
        await processor.patchChannel(channel.id, {
          status: 'inactive',
          lastTested: new Date().toISOString(),
        });
        tested += 1;
        inactive += 1;
      }
    }

    return NextResponse.json({
      message: 'Stream testing completed successfully. All required tables used.',
      tablesValidated: true,
      tested,
      active,
      inactive,
      source: sourceParam || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in test-streams cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to test streams',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

