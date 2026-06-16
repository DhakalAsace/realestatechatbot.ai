import { LegalPage } from "@/components/marketing/legal-page";
import { legalMetadata, requireLegalPage } from "@/lib/legal";

const page = requireLegalPage("/acceptable-use");

export const metadata = legalMetadata(page);

export default function Page() {
  return <LegalPage page={page} />;
}
