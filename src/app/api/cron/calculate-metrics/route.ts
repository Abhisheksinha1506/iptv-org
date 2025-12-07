import { NextResponse } from 'next/server';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { supabase } from '@/lib/supabase';

const processor = new SourceProcessor();

/**
 * Calculate quality metrics for all channels
 * 
 * REQUIRES ALL TABLES:
 * - channels: Source of channel data
 * - test_results: Source of test history for metrics calculation
 * - quality_metrics: Destination for calculated metrics
 */
export async function GET() {
  try {
    // Validate required tables exist
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

    // Get all channels (from channels table)
    const channels = await processor.getAllChannels();
    let updated = 0;
    let skipped = 0;

    for (const channel of channels) {
      try {
        // Get test results (from test_results table)
        const results = await processor.getTestResults(channel.id);
        if (results.length === 0) {
          skipped += 1;
          continue;
        }
        
        // Calculate metrics from test results
        const metrics = calculateQualityMetrics(results);
        
        // Save metrics (to quality_metrics table)
        await processor.saveQualityMetrics(channel.id, metrics);
        updated += 1;
      } catch (error) {
        console.error(`Failed to calculate metrics for channel ${channel.id}:`, error);
        skipped += 1;
      }
    }

    return NextResponse.json({
      message: 'Quality metrics calculated successfully. All required tables used.',
      tablesValidated: true,
      channelsUpdated: updated,
      channelsSkipped: skipped,
      totalChannels: channels.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

