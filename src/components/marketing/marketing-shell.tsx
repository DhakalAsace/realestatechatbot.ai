import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/marketing/json-ld";
import { faqJsonLd, homepage, marketingPages, siteConfig, type MarketingPage, webPageJsonLd } from "@/lib/marketing";

const navLinks = [
  { href: "/examples/real-estate-chatbot-examples", label: "Examples" },
  { href: "/guides/real-estate-lead-capture", label: "Lead capture" },
  { href: "/tools/real-estate-chatbot-template-generator", label: "Template tool" },
  { href: "/best-real-estate-chatbots", label: "Compare" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#162018]">
      <header className="border-b border-[#d9ded2] bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">RealEstateChatbot.ai</Link>
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Marketing navigation">
            {navLinks.map((link) => (
              <Link className="rounded-md border border-transparent px-3 py-2 font-semibold text-[#3f4b3f] hover:border-[#cbd5c7] hover:bg-white" href={link.href} key={link.href}>{link.label}</Link>
            ))}
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href={siteConfig.sampleBotPath}>Sample bot</Link>
            <Link className="rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" href={siteConfig.signupPath}>Sign in</Link>
          </nav>
        </div>
      </header>
      {children}
      <Footer />
    </main>
  );
}

export function MarketingHome() {
  const page = homepage;
  return (
    <MarketingShell>
      <JsonLd value={webPageJsonLd(page)} />
      <JsonLd value={faqJsonLd(page)} />
      <section className="relative min-h-[620px] overflow-hidden bg-[#10231b] text-white" style={{ backgroundImage: "linear-gradient(90deg, rgba(16,35,27,0.96), rgba(16,35,27,0.78), rgba(16,35,27,0.42)), url('/opengraph-image')", backgroundPosition: "center", backgroundSize: "cover" }}>
        <div className="mx-auto flex min-h-[620px] max-w-7xl items-end px-5 py-10 md:items-center md:py-16">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#b8d5c7]">{page.eyebrow}</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">{page.heroTitle}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#e2ece5]">{page.heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-md bg-[#f5c45b] px-5 py-3 text-sm font-semibold text-[#172014]" href={siteConfig.signupPath}>{page.primaryCta}</Link>
              <Link className="rounded-md border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white" href={siteConfig.sampleBotPath}>{page.secondaryCta}</Link>
            </div>
          </div>
        </div>
      </section>
      <ProductSurface />
      <SectionList page={page} />
      <LinkGrid />
      <FAQ page={page} />
    </MarketingShell>
  );
}

export function MarketingContentPage({ page, children }: { page: MarketingPage; children?: ReactNode }) {
  return (
    <MarketingShell>
      <JsonLd value={webPageJsonLd(page)} />
      <JsonLd value={faqJsonLd(page)} />
      <section className="border-b border-[#d9ded2] bg-[#eef4ec]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_360px] lg:py-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#556254]">{page.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">{page.heroTitle}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#556254]">{page.heroBody}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="rounded-md bg-[#173f2f] px-5 py-3 text-sm font-semibold text-white" href={siteConfig.signupPath}>{page.primaryCta}</Link>
              <Link className="rounded-md border border-[#cbd5c7] bg-white px-5 py-3 text-sm font-semibold" href={siteConfig.sampleBotPath}>{page.secondaryCta}</Link>
            </div>
          </div>
          <div className="rounded-lg border border-[#ccd6ca] bg-white p-5 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Intent</p>
            <p className="mt-3 text-2xl font-semibold">{page.intent.replaceAll("-", " ")}</p>
            <div className="mt-5 grid gap-2">
              {page.proof.map((item) => <div className="rounded-md bg-[#f5f7f2] px-3 py-2 text-sm font-semibold text-[#334238]" key={item}>{item}</div>)}
            </div>
          </div>
        </div>
      </section>
      {children}
      <SectionList page={page} />
      <LinkGrid activePath={page.path} />
      <FAQ page={page} />
    </MarketingShell>
  );
}

function ProductSurface() {
  const rows = [["Sarah Patel", "Buyer", "Hot", "1 month"], ["Maya Singh", "Seller", "Warm", "Valuation"], ["Open house QR", "Buyer", "New", "Showing"]];
  return (
    <section className="border-b border-[#d9ded2] bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[360px_1fr]">
        <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#657064]">Product loop</p><h2 className="mt-3 text-3xl font-semibold">From traffic source to agent-ready handoff.</h2><p className="mt-4 text-sm leading-6 text-[#657064]">Hosted links, widgets, QR codes, AI-safe replies, lead scoring, appointments, team routing, follow-up state, and usage limits all resolve to a single operational dashboard.</p></div>
        <div className="overflow-hidden rounded-lg border border-[#cbd5c7] bg-[#10231b] text-white shadow-sm">
          <div className="grid gap-0 md:grid-cols-[230px_1fr]">
            <div className="border-b border-white/10 bg-[#173f2f] p-4 md:border-b-0 md:border-r"><p className="font-mono text-xs uppercase tracking-[0.14em] text-[#b8d5c7]">Channels</p>{["Hosted link", "Website widget", "QR code", "Campaign"].map((item) => <div className="mt-3 rounded-md bg-white/10 px-3 py-2 text-sm" key={item}>{item}</div>)}</div>
            <div className="p-4"><div className="grid gap-3 md:grid-cols-3">{["32 leads", "11 appointments", "7 follow-ups"].map((item) => <div className="rounded-md bg-white/10 p-3" key={item}><p className="text-2xl font-semibold">{item.split(" ")[0]}</p><p className="text-xs uppercase tracking-[0.12em] text-[#b8d5c7]">{item.split(" ").slice(1).join(" ")}</p></div>)}</div><div className="mt-4 overflow-hidden rounded-md border border-white/10">{rows.map((row) => <div className="grid grid-cols-4 gap-2 border-b border-white/10 px-3 py-2 text-sm last:border-b-0" key={row.join("-")}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionList({ page }: { page: MarketingPage }) {
  return <section className="bg-[#f5f7f2]"><div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 md:grid-cols-3">{page.sections.map((section) => <article className="rounded-lg border border-[#d9ded2] bg-white p-5" key={section.title}><h2 className="text-xl font-semibold">{section.title}</h2><p className="mt-3 text-sm leading-6 text-[#657064]">{section.body}</p><ul className="mt-4 space-y-2 text-sm">{section.bullets.map((bullet) => <li className="flex gap-2" key={bullet}><span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2861a8]" />{bullet}</li>)}</ul></article>)}</div></section>;
}

function LinkGrid({ activePath }: { activePath?: string }) {
  return <section className="border-y border-[#d9ded2] bg-white"><div className="mx-auto max-w-7xl px-5 py-10"><div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#657064]">Distinct SEO intents</p><h2 className="mt-2 text-3xl font-semibold">Explore the real estate chatbot playbook.</h2></div><Link className="text-sm font-semibold text-[#2861a8]" href="/tools/real-estate-chatbot-template-generator">Use the template generator</Link></div><div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{marketingPages.filter((page) => page.path !== activePath).slice(0, 8).map((page) => <Link className="rounded-lg border border-[#d9ded2] bg-[#f7f9f4] p-4 hover:border-[#2861a8]" href={page.path} key={page.path}><p className="font-mono text-xs uppercase tracking-[0.12em] text-[#657064]">{page.intent.replaceAll("-", " ")}</p><p className="mt-2 font-semibold">{page.title}</p></Link>)}</div></div></section>;
}

function FAQ({ page }: { page: MarketingPage }) {
  return <section className="bg-[#f5f7f2]"><div className="mx-auto max-w-4xl px-5 py-10"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#657064]">FAQ</p><h2 className="mt-2 text-3xl font-semibold">Questions agents ask before adopting a chatbot.</h2><div className="mt-6 divide-y divide-[#d9ded2] rounded-lg border border-[#d9ded2] bg-white">{page.faq.map((item) => <div className="p-5" key={item.question}><h3 className="font-semibold">{item.question}</h3><p className="mt-2 text-sm leading-6 text-[#657064]">{item.answer}</p></div>)}</div></div></section>;
}

function Footer() {
  return <footer className="border-t border-[#d9ded2] bg-[#10231b] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">RealEstateChatbot.ai</p><p className="mt-1 text-sm text-[#b8d5c7]">{siteConfig.shortPromise}</p></div><div className="flex flex-wrap gap-3 text-sm text-[#dbe7df]"><Link href="/guides/how-to-build-a-real-estate-chatbot">Build guide</Link><Link href="/use-cases/open-house-chatbot">Open house</Link><Link href="/best-real-estate-chatbots">Compare</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/ai-disclaimer">AI limits</Link><Link href="/login">Dashboard</Link></div></div></footer>;
}
