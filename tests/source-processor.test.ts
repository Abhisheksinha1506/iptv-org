import { beforeEach, describe, expect, it } from "vitest";
import { SourceProcessor } from "@/lib/iptv/source-processor";
import { deleteValue, listKeys } from "@/lib/kv";
import type { Channel } from "@/lib/types";

async function clearNamespace(prefix: string): Promise<void> {
  const keys = await listKeys(`${prefix}*`);
  for (const key of keys) {
    await deleteValue(key);
  }
}

beforeEach(async function resetStore() {
  await clearNamespace("channel:");
  await clearNamespace("source-meta:");
  await clearNamespace("pending-updates");
});

describe("SourceProcessor", function suite() {
  it("saves and retrieves channels", async function testSave() {
    const processor = new SourceProcessor();
    const channels: Channel[] = [
      {
        id: "chn_1",
        name: "Demo",
        url: "https://example.com/demo.m3u8",
        country: "US",
        category: "news",
        qualityScore: 0,
        status: "untested",
        source: "demo",
      },
    ];

    await processor.saveChannels("demo", channels);
    const stored = await processor.getChannelsBySource("demo");

    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Demo");
  });
});

