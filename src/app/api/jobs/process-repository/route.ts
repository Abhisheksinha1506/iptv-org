import { NextRequest, NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';
import { parseM3U } from '@/lib/iptv/m3u-parser';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import { StreamTester } from '@/lib/iptv/stream-tester';
import { calculateQualityMetrics } from '@/lib/iptv/metrics';
import { getRepositoryById, upsertRepository } from '@/lib/supabase-adapter';
import type { Channel, StreamTestResult } from '@/lib/types';

const processor = new SourceProcessor();
const tester = new StreamTester();

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

async function testChannelsForSource(
  source: string,
  limit: number = 100,
): Promise<{ tested: number; active: number; inactive: number }> {
  const channels = await processor.getChannelsBySource(source);

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
      const result = await tester.testChannel(channel);
      await processor.saveTestResult(result);
      const isActive = result.status === 'success';
      if (isActive) {
        active += 1;
      } else {
        inactive += 1;
      }
      await processor.patchChannel(channel.id, {
        status: isActive ? 'active' : 'inactive',
        lastTested: result.testedAt,
        qualityScore: calculateQualityScore(result),
      });
      await processor.saveQualityMetrics(channel.id, calculateQualityMetrics([result]));
      tested += 1;
    } catch (error) {
      console.error(`Failed to test channel ${channel.id}:`, error);
      // Mark as inactive on error
      await processor.patchChannel(channel.id, {
        status: 'inactive',
        lastTested: new Date().toISOString(),
      });
      tested += 1;
      inactive += 1;
    }
  }

  return { tested, active, inactive };
}

export async function POST(request: NextRequest) {
  // Verify internal API key if set
  const internalKey = request.headers.get('X-Internal-Key');
  const expectedKey = process.env.INTERNAL_API_KEY || 'internal-key';
  if (internalKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { owner, repo, ref, commitSha } = body;

  if (!owner || !repo || !ref) {
    return NextResponse.json({ error: 'Missing required fields: owner, repo, ref' }, { status: 400 });
  }

  try {
    const tracker = new RepositoryTracker();
    const trackedRepos = await tracker.loadTrackedRepositories();

    // Find the tracked repository matching owner and repo
    const trackedRepo = trackedRepos.find(function findMatch(r) {
      return r.owner === owner && r.repo === repo;
    });

    if (!trackedRepo) {
      return NextResponse.json(
        {
          error: 'Repository not tracked',
          owner,
          repo,
        },
        { status: 404 },
      );
    }

    // Update repository with new commit SHA
    const updatedRepo = {
      ...trackedRepo,
      lastCommitSha: commitSha || trackedRepo.lastCommitSha,
      lastChecked: new Date().toISOString(),
    };
    await upsertRepository(updatedRepo);

    // Fetch updated files
    const files = await tracker.fetchUpdatedFiles(updatedRepo);
    const channels: Channel[] = [];

    for (const filePath of Object.keys(files)) {
      if (filePath.endsWith('.m3u') || filePath.endsWith('.m3u8')) {
        const parsed = parseM3U(files[filePath], trackedRepo.id, filePath);
        channels.push(...parsed);
      }
    }

    if (channels.length === 0) {
      return NextResponse.json({
        message: 'No M3U files found in repository',
        owner,
        repo,
        filesProcessed: Object.keys(files).length,
      });
    }

    // Save channels
    await processor.saveChannels(trackedRepo.id, channels);

    // Automatically test channels for this source (limit to 100 to avoid timeout)
    const testResults = await testChannelsForSource(trackedRepo.id, 100);

    return NextResponse.json({
      message: 'Repository processed successfully',
      owner,
      repo,
      channelsProcessed: channels.length,
      testResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing repository:', error);
    return NextResponse.json(
      {
        error: 'Failed to process repository',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

