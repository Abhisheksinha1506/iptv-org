import { NextResponse } from 'next/server';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import { SourceProcessor } from '@/lib/iptv/source-processor';

const processor = new SourceProcessor();

export async function GET() {
  const channels = await processor.getAllChannels();
  let updated = 0;
  for (const channel of channels) {
    const results = await processor.getTestResults(channel.id);
    if (results.length === 0) {
      continue;
    }
    const metrics = calculateQualityMetrics(results);
    await processor.saveQualityMetrics(channel.id, metrics);
    updated += 1;
  }

  return NextResponse.json({
    message: 'Metrics calculated',
    channels: updated,
  });
}

