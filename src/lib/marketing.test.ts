import { describe, expect, it } from "vitest";
import { allMarketingPages, faqJsonLd, getMarketingPage, requiredPhase9Paths, safeJsonLd } from "@/lib/marketing";

describe("Phase 9 marketing content map", () => {
  it("contains every required Phase 9 route exactly once", () => {
    const paths = allMarketingPages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of requiredPhase9Paths) expect(paths).toContain(path);
  });

  it("keeps supporting pages distinct by intent", () => {
    const intents = allMarketingPages.map((page) => page.intent);
    expect(new Set(intents).size).toBe(intents.length);
  });

  it("keeps non-homepage document titles from duplicating the site name", () => {
    const suffix = " | RealEstateChatbot.ai";
    for (const page of allMarketingPages.filter((item) => item.path !== "/")) {
      expect(page.metaTitle.endsWith(suffix)).toBe(false);
    }
  });

  it("adds FAQ schema data to every indexed marketing page", () => {
    for (const page of allMarketingPages) {
      expect(page.faq.length).toBeGreaterThanOrEqual(2);
      const schema = faqJsonLd(page) as { mainEntity: unknown[] };
      expect(schema.mainEntity).toHaveLength(page.faq.length);
    }
  });

  it("escapes JSON-LD strings before rendering", () => {
    expect(safeJsonLd({ text: "<script>bad()</script>" })).not.toContain("<script>");
  });

  it("returns route config by path", () => {
    expect(getMarketingPage("/best-real-estate-chatbots")?.intent).toBe("comparison-framework");
    expect(getMarketingPage("/missing")).toBeNull();
  });
});
