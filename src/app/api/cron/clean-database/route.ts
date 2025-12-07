import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Clean all tables and remove all data from the database
 * WARNING: This will delete ALL data including channels, test results, quality metrics, repositories, and updates
 */
export async function POST() {
  try {
    const results: Record<string, number> = {};

    // Helper function to delete all records from a table in batches
    async function deleteAllFromTable(
      tableName: string,
      idColumn: string,
      maxIterations: number = 20,
    ): Promise<number> {
      let totalDeleted = 0;
      let iterations = 0;

      while (iterations < maxIterations) {
        // Fetch a batch of IDs to delete
        const { data, error: fetchError } = await supabase
          .from(tableName)
          .select(idColumn)
          .limit(1000);

        if (fetchError) {
          throw new Error(`Failed to fetch from ${tableName}: ${fetchError.message}`);
        }

        if (!data || data.length === 0) {
          break; // No more records to delete
        }

        // Delete the batch
        const ids = data.map(function getIds(row) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (row as any)[idColumn] as string | number;
        });

        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .in(idColumn, ids);

        if (deleteError) {
          throw new Error(`Failed to delete from ${tableName}: ${deleteError.message}`);
        }

        totalDeleted += ids.length;
        iterations += 1;

        // If we got less than 1000, we've deleted everything
        if (ids.length < 1000) {
          break;
        }
      }

      return totalDeleted;
    }

    // Get initial counts for reporting
    const { count: testResultsCount } = await supabase
      .from('test_results')
      .select('*', { count: 'exact', head: true });
    
    const { count: qualityMetricsCount } = await supabase
      .from('quality_metrics')
      .select('*', { count: 'exact', head: true });
    
    const { count: channelsCount } = await supabase
      .from('channels')
      .select('*', { count: 'exact', head: true });
    
    const { count: updatesCount } = await supabase
      .from('repository_updates')
      .select('*', { count: 'exact', head: true });
    
    const { count: reposCount } = await supabase
      .from('repositories')
      .select('*', { count: 'exact', head: true });

    // Delete in order to respect foreign key constraints
    // 1. Delete test_results first (child table)
    results.test_results = await deleteAllFromTable('test_results', 'id');

    // 2. Delete quality_metrics (child table)
    results.quality_metrics = await deleteAllFromTable('quality_metrics', 'channel_id');

    // 3. Delete channels (parent table)
    results.channels = await deleteAllFromTable('channels', 'id');

    // 4. Delete repository_updates
    results.repository_updates = await deleteAllFromTable('repository_updates', 'id');

    // 5. Delete repositories
    results.repositories = await deleteAllFromTable('repositories', 'id');

    const totalDeleted = Object.values(results).reduce(function sum(acc, count) {
      return acc + count;
    }, 0);

    return NextResponse.json({
      success: true,
      message: 'All database tables cleaned successfully',
      deleted: results,
      totalDeleted,
      expectedCounts: {
        test_results: testResultsCount || 0,
        quality_metrics: qualityMetricsCount || 0,
        channels: channelsCount || 0,
        repository_updates: updatesCount || 0,
        repositories: reposCount || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning database:', error);
    return NextResponse.json(
      {
        error: 'Failed to clean database',
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
