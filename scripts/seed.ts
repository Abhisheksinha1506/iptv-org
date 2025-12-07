import process from "node:process";
import { parseM3U } from "@/lib/iptv/m3u-parser";
import { SourceProcessor } from "@/lib/iptv/source-processor";

const SAMPLE_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="DEMO1" tvg-name="Fusion News" tvg-country="US" group-title="news",Fusion News
https://stream.example.com/news/playlist.m3u8
#EXTINF:-1 tvg-id="DEMO2" tvg-name="Global Sports" tvg-country="GB" group-title="sports",Global Sports
https://stream.example.com/sports/playlist.m3u8
#EXTINF:-1 tvg-id="DEMO3" tvg-name="Cinema World" tvg-country="CA" group-title="entertainment",Cinema World
https://stream.example.com/cinema/playlist.m3u8
`;

async function main() {
  const processor = new SourceProcessor();
  const channels = parseM3U(SAMPLE_PLAYLIST, "seed");
  await processor.saveChannels("seed", channels);
  console.log(`Seeded ${channels.length} channels from sample playlist`);
  process.exit(0);
}

main().catch(function handleError(error) {
  console.error(error);
  process.exit(1);
});

