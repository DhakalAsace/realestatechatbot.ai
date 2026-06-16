import { redirect } from "next/navigation";
import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingHome } from "@/components/marketing/marketing-shell";
import { homepage, metadataFor, softwareApplicationJsonLd } from "@/lib/marketing";

export const metadata = metadataFor(homepage);

type HomeProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  if (code) {
    const target = new URLSearchParams({ code });
    if (next?.startsWith("/")) target.set("next", next);
    redirect("/auth/callback?" + target.toString());
  }
  return <><JsonLd value={softwareApplicationJsonLd()} /><MarketingHome /></>;
}
