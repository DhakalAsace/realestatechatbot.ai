import { MarketingContentPage } from "@/components/marketing/marketing-shell";
import { metadataFor, requireMarketingPage } from "@/lib/marketing";

const page = requireMarketingPage("/use-cases/property-recommendation-chatbot");

export const metadata = metadataFor(page);

export default function Page() {
  return <MarketingContentPage page={page}>
    
  </MarketingContentPage>;
}
