import { NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';
import { parseM3U } from '@/lib/iptv/m3u-parser';
import { SourceProcessor } from '@/lib/iptv/source-processor';
import type { Channel } from '@/lib/types';

export async function GET() {
  const tracker = new RepositoryTracker();
  const processor = new SourceProcessor();

  const updatedRepositories = await tracker.checkForUpdates();
  if (updatedRepositories.length === 0) {
    return NextResponse.json({ message: 'No repository updates detected' });
  }

  let totalChannels = 0;
  for (const repository of updatedRepositories) {
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
    }
  }

  return NextResponse.json({
    message: 'Repositories processed',
    repositories: updatedRepositories.length,
    channels: totalChannels,
  });
}

