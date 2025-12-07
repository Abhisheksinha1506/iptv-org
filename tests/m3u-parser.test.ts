import { describe, expect, it } from "vitest";
import { parseM3U } from "@/lib/iptv/m3u-parser";

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="demo" tvg-name="Demo" tvg-country="US" group-title="news",Demo Channel
https://example.com/stream.m3u8
#EXTINF:-1 tvg-id="demo2" tvg-name="Demo2" tvg-country="CA" group-title="sports",Demo2
https://example.com/stream2.m3u8
`;

describe("M3U parser", function suite() {
  it("parses channels with metadata", function testParse() {
    const channels = parseM3U(SAMPLE, "test");
    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({
      name: "Demo Channel",
      country: "US",
      category: "news",
      source: "test",
    });
  });
});

