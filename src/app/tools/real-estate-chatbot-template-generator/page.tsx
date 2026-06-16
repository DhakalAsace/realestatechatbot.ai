import { MarketingContentPage } from "@/components/marketing/marketing-shell";
import { TemplateGenerator } from "@/components/marketing/template-generator";
import { metadataFor, requireMarketingPage } from "@/lib/marketing";

const page = requireMarketingPage("/tools/real-estate-chatbot-template-generator");

export const metadata = metadataFor(page);

export default function Page() {
  return <MarketingContentPage page={page}>
    <TemplateGenerator />
  </MarketingContentPage>;
}
