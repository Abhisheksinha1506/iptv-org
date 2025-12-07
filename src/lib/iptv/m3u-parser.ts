import crypto from 'node:crypto';
import type { Channel } from '@/lib/types';

interface ExtInfAttributes {
  [key: string]: string;
}

function createChannelId(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return `chn_${hash.substring(0, 16)}`;
}

function parseAttributes(line: string): ExtInfAttributes {
  const attributes: ExtInfAttributes = {};
  const pattern = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null = pattern.exec(line);
  while (match) {
    attributes[match[1]] = match[2];
    match = pattern.exec(line);
  }
  return attributes;
}

function normalizeCountry(value?: string): string {
  if (!value) {
    return 'unknown';
  }
  return value.toUpperCase();
}

function normalizeCategory(value?: string, channelName?: string): string {
  if (value) {
    return value.toLowerCase();
  }
  if (!channelName) {
    return 'general';
  }
  const name = channelName.toLowerCase();
  const categoryRules: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /\b(news|cnn|bbc|reuters|al jazeera|fox news|msnbc|sky news|nbc news|abc news|cbs news|cnbc|bloomberg)\b/i, category: 'news' },
    { pattern: /^(nbc|abc|cbs|fox|cnn|msnbc)\b/i, category: 'news' }, // Major US news networks
    { pattern: /\b(sport|espn|fox sports|eurosport|nfl|nba|mlb|soccer|football|tennis|golf|nhl|ufc|wwe)\b/i, category: 'sports' },
    { pattern: /\b(movie|cinema|film|hbo|netflix|disney|showtime|starz|amc|fx|tnt)\b/i, category: 'movies' },
    { pattern: /\b(music|mtv|vibe|vevo|radio|hit|top|billboard)\b/i, category: 'music' },
    { pattern: /\b(kids|cartoon|disney|nickelodeon|nick|pbs kids|cartoon network)\b/i, category: 'kids' },
    { pattern: /\b(documentary|discovery|national geographic|history|science|nat geo)\b/i, category: 'documentary' },
    { pattern: /\b(comedy|funny|humor|comedy central)\b/i, category: 'comedy' },
    { pattern: /\b(religion|god|church|bible|gospel|prayer|christian)\b/i, category: 'religion' },
    { pattern: /\b(shopping|qvc|hsn|shop)\b/i, category: 'shopping' },
    { pattern: /\b(weather|climate|weather channel)\b/i, category: 'weather' },
  ];
  for (const rule of categoryRules) {
    if (rule.pattern.test(name)) {
      return rule.category;
    }
  }
  return 'general';
}

function extractCountryFromPath(filePath: string): string | undefined {
  // Try to extract 2-letter country code from filename (e.g., streams/us.m3u -> US)
  const countryCodePattern = /[\/\\]([a-z]{2})\.m3u/i;
  let match = filePath.match(countryCodePattern);
  if (match && match[1]) {
    const code = match[1].toUpperCase();
    // Validate it's a real country code (basic check - 2 letters)
    if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
      return code;
    }
  }
  // Try alternative patterns like streams_us.m3u or us_streams.m3u
  match = filePath.match(/([a-z]{2})[._-]/i);
  if (match && match[1]) {
    const code = match[1].toUpperCase();
    if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
      return code;
    }
  }
  // Map common country names to codes
  const countryNameMap: Record<string, string> = {
    'united-states': 'US',
    'united-kingdom': 'GB',
    'united-kingdom-england': 'GB',
    'united-kingdom-scotland': 'GB',
    'united-kingdom-wales': 'GB',
    'united-kingdom-northern-ireland': 'GB',
  };
  const lowerPath = filePath.toLowerCase();
  for (const [key, code] of Object.entries(countryNameMap)) {
    if (lowerPath.includes(key)) {
      return code;
    }
  }
  return undefined;
}

function buildChannel(
  attributes: ExtInfAttributes,
  name: string,
  url: string,
  source: string,
  filePath?: string,
): Channel {
  const countryFromPath = filePath ? extractCountryFromPath(filePath) : undefined;
  return {
    id: createChannelId(url),
    name: name.trim(),
    url: url.trim(),
    country: normalizeCountry(attributes['tvg-country'] || countryFromPath),
    category: normalizeCategory(attributes['group-title'], name),
    logo: attributes['tvg-logo'],
    tvgId: attributes['tvg-id'],
    tvgName: attributes['tvg-name'],
    qualityScore: 0,
    status: 'untested',
    source,
  };
}

export function parseM3U(content: string, source: string, filePath?: string): Channel[] {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF:')) {
      continue;
    }
    const infoLine = line;
    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith('#')) {
      continue;
    }
    const attributes = parseAttributes(infoLine);
    const nameMatch = infoLine.split(',').pop();
    if (!nameMatch) {
      continue;
    }
    const channel = buildChannel(attributes, nameMatch, urlLine, source, filePath);
    channels.push(channel);
  }
  return channels;
}

