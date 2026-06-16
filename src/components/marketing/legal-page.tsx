import { MarketingShell } from "@/components/marketing/marketing-shell";
import type { LegalPage as LegalPageConfig } from "@/lib/legal";

export function LegalPage({ page }: { page: LegalPageConfig }) {
  return (
    <MarketingShell>
      <section className="border-b border-[#d9ded2] bg-[#eef4ec]">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#556254]">Launch readiness</p>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{page.title}</h1>
          <p className="mt-4 text-lg leading-8 text-[#556254]">{page.description}</p>
          <p className="mt-4 text-sm text-[#657064]">Last updated: {page.updated}</p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto max-w-4xl space-y-6 px-5 py-10">
          {page.sections.map((section) => (
            <article className="rounded-lg border border-[#d9ded2] bg-[#f7f9f4] p-5" key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#4f5d51]">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
