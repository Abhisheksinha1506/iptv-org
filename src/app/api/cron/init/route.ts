import { NextResponse } from 'next/server';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { supabase } from '@/lib/supabase';

const processor = new SourceProcessor();

export async function GET() {
  try {
    // Get all channels
    const channels = await processor.getAllChannels();
    
    // Count tested channels
    const testedChannels = channels.filter(function filterTested(channel) {
      return channel.status === 'active' || channel.status === 'inactive';
    });
    const testedCount = testedChannels.length;

    // If no tested channels, we're good
    if (testedCount === 0) {
      return NextResponse.json({
        initialized: true,
        message: 'No tested channels found',
        testedCount: 0,
        totalChannels: channels.length,
      });
    }

    // Check if there are any actual test results stored
    // (mock data didn't save test results)
    const { data: testResults, error } = await supabase
      .from('test_results')
      .select('id')
      .limit(1);
    const hasRealTestResults = !error && testResults && testResults.length > 0;

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
        message: `Reset ${reset} channels to untested (detected mock data)`,
      });
    }

    // Real test results exist, no reset needed
    return NextResponse.json({
      initialized: true,
      reset: false,
      testedCount,
      testResultsCount: hasRealTestResults ? '> 0' : 0,
      totalChannels: channels.length,
      message: 'Real test data detected, no reset needed',
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    return NextResponse.json(
      { error: 'Failed to initialize', initialized: false },
      { status: 500 },
    );
  }
}

