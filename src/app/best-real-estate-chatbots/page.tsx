import { MarketingContentPage } from "@/components/marketing/marketing-shell";
import { metadataFor, requireMarketingPage } from "@/lib/marketing";

const page = requireMarketingPage("/best-real-estate-chatbots");

export const metadata = metadataFor(page);

export default function Page() {
  return <MarketingContentPage page={page}>
    
  </MarketingContentPage>;
}
