import { NextRequest, NextResponse } from 'next/server';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { getChannelById, getQualityMetrics } from '@/lib/supabase-adapter';

const processor = new SourceProcessor();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const channel = await getChannelById(id);

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const qualityMetrics = await getQualityMetrics(id);
    const testResults = await processor.getTestResults(id);

    return NextResponse.json({
      channel,
      qualityMetrics: qualityMetrics || null,
      testResults: testResults.slice(-10).reverse(), // Last 10 test results, most recent first
    });
  } catch (error) {
    console.error('Error fetching quality data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

