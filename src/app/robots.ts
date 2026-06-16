import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/marketing";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/dashboard/", "/embed/", "/invite/", "/login", "/unsubscribe/"] }, sitemap: absoluteUrl("/sitemap.xml") };
}
