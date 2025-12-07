import { NextResponse } from 'next/server';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { supabase } from '@/lib/supabase';

const processor = new SourceProcessor();

// Required tables for the application
const REQUIRED_TABLES = [
  'repositories',
  'channels',
  'test_results',
  'quality_metrics',
  'repository_updates',
] as const;

async function validateTablesExist(): Promise<{
  allExist: boolean;
  missing: string[];
  existing: string[];
}> {
  const missing: string[] = [];
  const existing: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        // Check if it's a "table doesn't exist" error
        if (error.code === 'PGRST205' || error.message.includes('does not exist') || error.message.includes('relation')) {
          missing.push(table);
        } else {
          // Other error (like no rows) means table exists
          existing.push(table);
        }
      } else {
        existing.push(table);
      }
    } catch (error) {
      missing.push(table);
    }
  }

  return {
    allExist: missing.length === 0,
    missing,
    existing,
  };
}

export async function GET() {
  try {
    // Step 1: Validate all required tables exist
    const tableValidation = await validateTablesExist();
    
    if (!tableValidation.allExist) {
      return NextResponse.json(
        {
          initialized: false,
          error: 'Missing required database tables',
          missingTables: tableValidation.missing,
          existingTables: tableValidation.existing,
          message: `The following required tables are missing: ${tableValidation.missing.join(', ')}. Please run the database migration (supabase/migrations/001_initial_schema.sql)`,
        },
        { status: 500 },
      );
    }

    // Step 2: Validate repositories table has at least one entry or can be initialized
    const { data: repos, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .limit(1);

    if (repoError && repoError.code !== 'PGRST116') {
      return NextResponse.json(
        {
          initialized: false,
          error: 'Failed to access repositories table',
          message: repoError.message,
        },
        { status: 500 },
      );
    }

    // Step 3: Get all channels
    const channels = await processor.getAllChannels();
    
    // Step 4: Count tested channels
    const testedChannels = channels.filter(function filterTested(channel) {
      return channel.status === 'active' || channel.status === 'inactive';
    });
    const testedCount = testedChannels.length;

    // Step 5: Validate test_results table is accessible
    const { data: testResults, error: testError } = await supabase
      .from('test_results')
      .select('id')
      .limit(1);
    
    if (testError && testError.code !== 'PGRST116') {
      return NextResponse.json(
        {
          initialized: false,
          error: 'Failed to access test_results table',
          message: testError.message,
        },
        { status: 500 },
      );
    }
    const hasRealTestResults = testResults && testResults.length > 0;

    // Step 6: Validate quality_metrics table is accessible
    const { data: metrics, error: metricsError } = await supabase
      .from('quality_metrics')
      .select('channel_id')
      .limit(1);
    
    if (metricsError && metricsError.code !== 'PGRST116') {
      return NextResponse.json(
        {
          initialized: false,
          error: 'Failed to access quality_metrics table',
          message: metricsError.message,
        },
        { status: 500 },
      );
    }

    // Step 7: Validate repository_updates table is accessible
    const { data: updates, error: updatesError } = await supabase
      .from('repository_updates')
      .select('id')
      .limit(1);
    
    if (updatesError && updatesError.code !== 'PGRST116') {
      return NextResponse.json(
        {
          initialized: false,
          error: 'Failed to access repository_updates table',
          message: updatesError.message,
        },
        { status: 500 },
      );
    }

    // If no tested channels, we're good
    if (testedCount === 0) {
      return NextResponse.json({
        initialized: true,
        message: 'Database initialized successfully. All required tables exist.',
        tablesValidated: true,
        testedCount: 0,
        totalChannels: channels.length,
        repositoriesCount: repos?.length || 0,
      });
    }

    // If there are tested channels but no test results, it's likely mock data
    if (!hasRealTestResults) {
      console.log('[Init] Detected old mock test data. Resetting all channels...');
      let reset = 0;

      for (const channel of channels) {
        await processor.patchChannel(channel.id, {
          status: 'untested',
          qualityScore: 0,
        });
        reset += 1;
      }

      return NextResponse.json({
        initialized: true,
        reset: true,
        resetCount: reset,
        tablesValidated: true,
        message: `Reset ${reset} channels to untested (detected mock data). All required tables exist.`,
      });
    }

    // Real test results exist, no reset needed
    return NextResponse.json({
      initialized: true,
      reset: false,
      tablesValidated: true,
      testedCount,
      testResultsCount: hasRealTestResults ? '> 0' : 0,
      totalChannels: channels.length,
      repositoriesCount: repos?.length || 0,
      message: 'Database initialized successfully. All required tables exist and contain valid data.',
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize',
        initialized: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

