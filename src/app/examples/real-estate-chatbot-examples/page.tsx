import { MarketingContentPage } from "@/components/marketing/marketing-shell";
import { metadataFor, requireMarketingPage } from "@/lib/marketing";

const page = requireMarketingPage("/examples/real-estate-chatbot-examples");

export const metadata = metadataFor(page);

export default function Page() {
  return <MarketingContentPage page={page}>
    
  </MarketingContentPage>;
}
