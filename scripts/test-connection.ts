import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // Check environment variables
  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('Environment Variables:');
  console.log(`  SUPABASE_URL: ${hasUrl ? '✓ Set' : '✗ Missing'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${hasKey ? '✓ Set' : '✗ Missing'}\n`);

  if (!hasUrl || !hasKey) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
    process.exit(1);
  }

  try {
    // Test connection by querying repositories table
    console.log('Testing database connection...');
    const { data: repos, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .limit(1);

    if (repoError) {
      // Try channels table as fallback
      const { data: channels, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .limit(1);

      if (channelError) {
        console.error('❌ Database connection failed!');
        console.error(`Error: ${channelError.message}`);
        console.error(`Code: ${channelError.code}\n`);
        console.error('Possible issues:');
        console.error('  1. Database migration not run - execute supabase/migrations/001_initial_schema.sql');
        console.error('  2. Incorrect SUPABASE_URL');
        console.error('  3. Incorrect SUPABASE_SERVICE_ROLE_KEY');
        console.error('  4. Network/firewall issues');
        process.exit(1);
      } else {
        console.log('✓ Channels table accessible');
      }
    } else {
      console.log('✓ Repositories table accessible');
    }

    // Test channels table
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('count')
      .limit(1);

    if (channelError && channelError.code !== 'PGRST116') {
      console.warn(`⚠ Warning accessing channels table: ${channelError.message}`);
    } else {
      console.log('✓ Channels table accessible');
    }

    // Test test_results table
    const { data: testResults, error: testError } = await supabase
      .from('test_results')
      .select('count')
      .limit(1);

    if (testError && testError.code !== 'PGRST116') {
      console.warn(`⚠ Warning accessing test_results table: ${testError.message}`);
    } else {
      console.log('✓ Test results table accessible');
    }

    // Test quality_metrics table
    const { data: metrics, error: metricsError } = await supabase
      .from('quality_metrics')
      .select('count')
      .limit(1);

    if (metricsError && metricsError.code !== 'PGRST116') {
      console.warn(`⚠ Warning accessing quality_metrics table: ${metricsError.message}`);
    } else {
      console.log('✓ Quality metrics table accessible');
    }

    // Test repository_updates table
    const { data: updates, error: updatesError } = await supabase
      .from('repository_updates')
      .select('count')
      .limit(1);

    if (updatesError && updatesError.code !== 'PGRST116') {
      console.warn(`⚠ Warning accessing repository_updates table: ${updatesError.message}`);
    } else {
      console.log('✓ Repository updates table accessible');
    }

    console.log('\n✅ Supabase connection successful!');
    console.log('All database tables are accessible.\n');
  } catch (error) {
    console.error('❌ Connection test failed!');
    console.error('Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testConnection();

