import type { MetadataRoute } from "next";
import { legalPages } from "@/lib/legal";
import { absoluteUrl, allMarketingPages } from "@/lib/marketing";

const lastModified = new Date("2026-06-16T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...allMarketingPages.map((page) => ({ url: absoluteUrl(page.path), lastModified, changeFrequency: page.path === "/" ? ("weekly" as const) : ("monthly" as const), priority: page.sitemapPriority })),
    ...legalPages.map((page) => ({ url: absoluteUrl(page.path), lastModified, changeFrequency: "yearly" as const, priority: 0.35 })),
  ];
}
