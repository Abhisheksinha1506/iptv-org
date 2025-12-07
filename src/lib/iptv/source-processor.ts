import type { Channel, QualityMetrics, RepositoryUpdate, StreamTestResult } from '@/lib/types';
import {
  getAllChannels as getAllChannelsFromDb,
  getChannelsBySource as getChannelsBySourceFromDb,
  upsertChannel,
  updateChannel,
  saveTestResult as saveTestResultToDb,
  getTestResults as getTestResultsFromDb,
  saveQualityMetrics as saveQualityMetricsToDb,
  saveSourceMetadata,
  appendRepositoryUpdate,
} from '@/lib/supabase-adapter';

export class SourceProcessor {
  async getAllChannels(): Promise<Channel[]> {
    return getAllChannelsFromDb();
  }

  async getChannelsBySource(source: string): Promise<Channel[]> {
    return getChannelsBySourceFromDb(source);
  }

  async saveChannels(source: string, incomingChannels: Channel[]): Promise<void> {
    const existing = await this.getChannelsBySource(source);
    const incomingIds = new Set(incomingChannels.map(function mapIds(channel) {
      return channel.id;
    }));

    let added = 0;
    let updated = 0;

    for (const channel of incomingChannels) {
      const stored = existing.find(function matchChannel(item) {
        return item.id === channel.id;
      });
      if (!stored) {
        added += 1;
      } else if (stored.url !== channel.url || stored.status !== channel.status) {
        updated += 1;
      }
      await upsertChannel(channel);
    }

    let removed = 0;
    for (const channel of existing) {
      if (!incomingIds.has(channel.id)) {
        removed += 1;
        const updatedChannel: Channel = {
          ...channel,
          status: 'inactive',
        };
        await upsertChannel(updatedChannel);
      }
    }

    await saveSourceMetadata(source, incomingChannels.length);

    await appendRepositoryUpdate({
      repository: source,
      timestamp: new Date().toISOString(),
      message: `Processed ${incomingChannels.length} channels`,
      channelsAdded: added,
      channelsUpdated: updated,
      channelsRemoved: removed,
    });
  }

  async patchChannel(channelId: string, updates: Partial<Channel>): Promise<Channel | null> {
    return updateChannel(channelId, updates);
  }

  async saveTestResult(result: StreamTestResult): Promise<void> {
    await saveTestResultToDb(result);
  }

  async getTestResults(channelId: string): Promise<StreamTestResult[]> {
    return getTestResultsFromDb(channelId);
  }

  async saveQualityMetrics(channelId: string, metrics: QualityMetrics): Promise<void> {
    await saveQualityMetricsToDb(channelId, metrics);
  }
}

