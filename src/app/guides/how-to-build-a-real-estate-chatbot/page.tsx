import { MarketingContentPage } from "@/components/marketing/marketing-shell";
import { metadataFor, requireMarketingPage } from "@/lib/marketing";

const page = requireMarketingPage("/guides/how-to-build-a-real-estate-chatbot");

export const metadata = metadataFor(page);

export default function Page() {
  return <MarketingContentPage page={page}>
    
  </MarketingContentPage>;
}
