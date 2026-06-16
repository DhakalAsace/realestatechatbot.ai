import { describe, expect, it } from "vitest";
import {
  buildAttribution,
  buildChannelUrl,
  buildWidgetSnippet,
  isPublicChannelKey,
  isSourceUrlAllowed,
  normalizeAllowedOrigins,
  sanitizeSourceText,
  sanitizeUrl,
  sourceDisplayLabel,
} from "@/lib/channels";

describe("channel helpers", () => {
  it("validates public channel keys", () => {
    expect(isPublicChannelKey("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isPublicChannelKey("0123456789abcdef0123456789abcdeg")).toBe(false);
    expect(isPublicChannelKey("short")).toBe(false);
  });

  it("sanitizes source text and URLs", () => {
    expect(sanitizeSourceText("  spring   launch  ", 80)).toBe("spring launch");
    expect(sanitizeSourceText("   ", 80)).toBeNull();
    expect(sanitizeUrl("https://example.com/path?x=1")).toBe("https://example.com/path?x=1");
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("normalizes and enforces widget origins", () => {
    const origins = normalizeAllowedOrigins("example.com\nhttps://sub.example.com/page");
    expect(origins).toEqual(["https://example.com", "https://sub.example.com"]);
    expect(isSourceUrlAllowed("https://example.com/listing", origins)).toBe(true);
    expect(isSourceUrlAllowed("https://other.example/listing", origins)).toBe(false);
    expect(isSourceUrlAllowed("https://example.com/listing", [])).toBe(false);
    expect(isSourceUrlAllowed(null, origins)).toBe(false);
  });

  it("builds attribution with UTM overrides and channel fallbacks", () => {
    expect(
      buildAttribution({
        channelType: "campaign",
        channelSource: "newsletter",
        channelMedium: "email",
        channelCampaign: "spring",
        channelContent: "hero",
        sourceUrl: "https://agent.example/listing",
        referrer: "https://search.example",
        utm: { source: "instagram", medium: "social", campaign: "reels", content: "video", term: "duplex" },
      }),
    ).toEqual({
      source: "instagram",
      medium: "social",
      campaign: "reels",
      content: "video",
      term: "duplex",
      sourceUrl: "https://agent.example/listing",
      referrer: "https://search.example/",
    });
  });

  it("builds public URLs and display labels", () => {
    const key = "0123456789abcdef0123456789abcdef";
    expect(buildChannelUrl("https://app.example/", "sarah-patel", key)).toBe(`https://app.example/c/sarah-patel?ch=${key}`);
    expect(buildWidgetSnippet("https://app.example/", key)).toBe(`<script async src="https://app.example/widget.js?channel=${key}"></script>`);
    expect(sourceDisplayLabel({ source_label: "Open house QR", source_type: "qr_code" })).toBe("Open house QR");
    expect(sourceDisplayLabel({ source_type: "web_embed" })).toBe("Website widget");
    expect(sourceDisplayLabel({ source: "instagram", medium: "social" })).toBe("instagram / social");
  });
});
