import { NextResponse } from 'next/server';
import { SourceProcessor } from '@/lib/iptv/source-processor';

const processor = new SourceProcessor();

export async function GET() {
  try {
    const channels = await processor.getAllChannels();
    let reset = 0;

    for (const channel of channels) {
      // Reset all channels to untested status
      await processor.patchChannel(channel.id, {
        status: 'untested',
        qualityScore: 0,
      });
      reset += 1;
    }

    return NextResponse.json({
      message: 'All channels reset to untested',
      reset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error resetting tests:', error);
    return NextResponse.json(
      { error: 'Failed to reset tests' },
      { status: 500 },
    );
  }
}

