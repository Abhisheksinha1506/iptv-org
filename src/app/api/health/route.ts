import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Health check endpoint to verify Supabase connection
 */
export async function GET() {
  try {
    // Test basic connection by querying a simple table
    const { data, error } = await supabase.from('repositories').select('count').limit(1);

    if (error) {
      // If repositories table doesn't exist, try channels table
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .select('count')
        .limit(1);

      if (channelError) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Supabase connection failed',
            error: channelError.message,
            details: {
              repositoriesError: error.message,
              channelsError: channelError.message,
              hint: 'Make sure you have run the database migration (supabase/migrations/001_initial_schema.sql)',
            },
          },
          { status: 500 },
        );
      }
    }

    // Test write capability by checking if we can query
    const { data: testQuery, error: testError } = await supabase
      .from('repositories')
      .select('id')
      .limit(1);

    if (testError && testError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      return NextResponse.json(
        {
          status: 'error',
          message: 'Supabase query failed',
          error: testError.message,
          code: testError.code,
        },
        { status: 500 },
      );
    }

    // Check environment variables
    const hasUrl = Boolean(process.env.SUPABASE_URL);
    const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    return NextResponse.json({
      status: 'ok',
      message: 'Supabase connection successful',
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: hasUrl,
        hasServiceRoleKey: hasKey,
        urlConfigured: hasUrl ? 'Yes' : 'No (check SUPABASE_URL)',
        keyConfigured: hasKey ? 'Yes' : 'No (check SUPABASE_SERVICE_ROLE_KEY)',
      },
      database: {
        connection: 'successful',
        tablesAccessible: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to connect to Supabase',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

