import type { MetadataRoute } from "next";
import { absoluteUrl, allMarketingPages } from "@/lib/marketing";

const lastModified = new Date("2026-06-16T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return allMarketingPages.map((page) => ({ url: absoluteUrl(page.path), lastModified, changeFrequency: page.path === "/" ? "weekly" : "monthly", priority: page.sitemapPriority }));
}
