import { safeJsonLd } from "@/lib/marketing";

export function JsonLd({ value }: { value: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(value) }} />;
}
