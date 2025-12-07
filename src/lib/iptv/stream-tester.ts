import type { Channel, StreamTestResult } from '@/lib/types';

export interface StreamTestOptions {
  region?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds

export class StreamTester {
  async testChannel(channel: Channel, options?: StreamTestOptions): Promise<StreamTestResult> {
    const startTime = Date.now();
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const region = options?.region ?? 'local';
    const testedAt = new Date().toISOString();

    try {
      // First, check if URL is accessible with HEAD request
      const headResponse = await this.checkStreamAvailability(channel.url, timeout);
      
      if (!headResponse.success) {
        return {
          channelId: channel.id,
          status: 'failure',
          responseTimeMs: Date.now() - startTime,
          bitrateKbps: 0,
          resolution: 'unknown',
          testedAt,
          region,
        };
      }

      // If it's an M3U8 playlist, try to fetch and parse it
      if (channel.url.includes('.m3u8') || channel.url.includes('.m3u')) {
        const playlistResult = await this.testPlaylistStream(channel.url, timeout);
        return {
          channelId: channel.id,
          status: playlistResult.success ? 'success' : 'failure',
          responseTimeMs: Date.now() - startTime,
          bitrateKbps: playlistResult.bitrateKbps,
          resolution: playlistResult.resolution,
          testedAt,
          region,
        };
      }

      // For other stream types, just check if they're accessible
      return {
        channelId: channel.id,
        status: 'success',
        responseTimeMs: Date.now() - startTime,
        bitrateKbps: 0, // Unknown for non-M3U8 streams
        resolution: 'unknown',
        testedAt,
        region,
      };
    } catch (error) {
      console.error(`Stream test error for ${channel.url}:`, error);
      return {
        channelId: channel.id,
        status: 'failure',
        responseTimeMs: Date.now() - startTime,
        bitrateKbps: 0,
        resolution: 'unknown',
        testedAt,
        region,
      };
    }
  }

  private async checkStreamAvailability(
    url: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; statusCode?: number }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Tester/1.0)',
        },
      });

      clearTimeout(timeoutId);

      // Accept 2xx and 3xx status codes as success
      const success = response.status >= 200 && response.status < 400;
      return { success, statusCode: response.status };
    } catch (error) {
      // Handle network errors, timeouts, etc.
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false };
      }
      return { success: false };
    }
  }

  private async testPlaylistStream(
    url: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; bitrateKbps: number; resolution: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Tester/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, bitrateKbps: 0, resolution: 'unknown' };
      }

      const playlistContent = await response.text();
      
      // Parse M3U8 playlist to extract stream info
      const streamInfo = this.parsePlaylistInfo(playlistContent);
      
      return {
        success: true,
        bitrateKbps: streamInfo.bitrateKbps,
        resolution: streamInfo.resolution,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, bitrateKbps: 0, resolution: 'unknown' };
      }
      return { success: false, bitrateKbps: 0, resolution: 'unknown' };
    }
  }

  private parsePlaylistInfo(playlistContent: string): { bitrateKbps: number; resolution: string } {
    let bitrateKbps = 0;
    let resolution = 'unknown';

    const lines = playlistContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse #EXT-X-STREAM-INF for HLS playlists
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        // Extract BANDWIDTH (bitrate)
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
        if (bandwidthMatch) {
          // Convert to Kbps
          bitrateKbps = Math.round(parseInt(bandwidthMatch[1], 10) / 1000);
        }

        // Extract RESOLUTION
        const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
        if (resolutionMatch) {
          resolution = resolutionMatch[1];
        }
      }

      // Parse #EXTINF for regular M3U playlists
      if (line.startsWith('#EXTINF:')) {
        // Try to extract resolution from the line or channel name
        const resMatch = line.match(/(\d{3,4}p|\d+x\d+)/i);
        if (resMatch) {
          const res = resMatch[1];
          if (res.includes('x')) {
            resolution = res;
          } else if (res.includes('p')) {
            // Convert 720p, 1080p, etc. to resolution
            const height = parseInt(res.replace('p', ''), 10);
            if (height === 720) resolution = '1280x720';
            else if (height === 1080) resolution = '1920x1080';
            else if (height === 480) resolution = '854x480';
            else if (height === 360) resolution = '640x360';
            else if (height === 240) resolution = '426x240';
          }
        }

        // Estimate bitrate based on resolution if not found
        if (bitrateKbps === 0 && resolution !== 'unknown') {
          if (resolution.includes('1920x1080')) bitrateKbps = 5000;
          else if (resolution.includes('1280x720')) bitrateKbps = 2500;
          else if (resolution.includes('854x480')) bitrateKbps = 1500;
          else if (resolution.includes('640x360')) bitrateKbps = 800;
          else if (resolution.includes('426x240')) bitrateKbps = 400;
          else bitrateKbps = 1000; // Default estimate
        }
      }
    }

    // Default values if nothing found
    if (bitrateKbps === 0) {
      bitrateKbps = 1000; // Default estimate
    }
    if (resolution === 'unknown') {
      resolution = '1280x720'; // Default assumption
    }

    return { bitrateKbps, resolution };
  }
}
