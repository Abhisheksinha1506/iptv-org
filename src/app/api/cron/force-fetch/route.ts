import { NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';
import { parseM3U } from '@/lib/iptv/m3u-parser';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import type { Channel } from '@/lib/types';

export async function GET() {
  const tracker = new RepositoryTracker();
  const processor = new SourceProcessor();

  // Force fetch all tracked repositories regardless of commit SHA
  const tracked = await tracker.loadTrackedRepositories();
  if (tracked.length === 0) {
    await tracker.initializeDefaultRepositories();
    const fresh = await tracker.loadTrackedRepositories();
    tracked.push(...fresh);
  }

  let totalChannels = 0;
  const processed: string[] = [];

  for (const repository of tracked) {
    try {
      const files = await tracker.fetchUpdatedFiles(repository);
      const channels: Channel[] = [];
      for (const filePath of Object.keys(files)) {
        if (filePath.endsWith('.m3u') || filePath.endsWith('.m3u8')) {
          const parsed = parseM3U(files[filePath], repository.id, filePath);
          channels.push(...parsed);
        }
      }
      if (channels.length > 0) {
        await processor.saveChannels(repository.id, channels);
        totalChannels += channels.length;
        processed.push(repository.id);
      }
    } catch (error) {
      console.error(`Error processing ${repository.id}:`, error);
    }
  }

  return NextResponse.json({
    message: 'Force fetch completed',
    repositories: processed.length,
    channels: totalChannels,
    processed,
  });
}

