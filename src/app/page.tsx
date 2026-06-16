import { redirect } from "next/navigation";
import Link from "next/link";

const checkpoints = [
  "Billing dashboard with plan and usage meters",
  "Stripe test-mode Checkout and Portal fail safely until credentials are configured",
  "Signed Stripe webhook verification with retry-safe event handling",
  "Atomic Supabase usage reservations for chat, AI, and follow-up emails",
  "Database-enforced limits for bots, channels, team seats, properties, and knowledge",
  "RLS-protected billing, subscription, and usage data",
  "Full Phase 1-8 browser regression suite",
];

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  if (code) {
    const target = new URLSearchParams({ code });
    if (next?.startsWith("/")) target.set("next", next);
    redirect(`/auth/callback?${target.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#162018]">
      <header className="border-b border-[#d9ded2] bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Phase 8 review</p>
            <h1 className="text-xl font-semibold">RealEstateChatbot.ai</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-semibold" href="/c/sarah-patel">
              Sample bot
            </Link>
            <Link className="rounded-md bg-[#173f2f] px-3 py-2 font-semibold text-white" href="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-[#d9ded2] bg-white p-6 md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Multi-channel lead assistant</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            Turn real estate traffic into qualified appointments 24/7.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#657064]">
            Phase 8 adds the billing spine: workspace plans, usage meters, server-side entitlements, Stripe test-mode Checkout and Portal hooks, signed webhooks, and fail-closed limits before paid actions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-md bg-[#173f2f] px-5 py-3 text-sm font-semibold text-white" href="/login">
              Open dashboard
            </Link>
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-5 py-3 text-sm font-semibold" href="/dashboard/billing">
              Review billing
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-[#d9ded2] bg-white p-5">
          <h3 className="font-semibold">Phase 8 review checklist</h3>
          <div className="mt-4 space-y-3">
            {checkpoints.map((item) => (
              <div className="flex gap-3 rounded-md bg-[#f7f9f4] p-3" key={item}>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2861a8]" />
                <p className="text-sm leading-6">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md bg-[#fff5df] p-3 text-sm leading-6 text-[#6c4b0b]">
            Autonomous review is active for this phase: lint, typecheck, unit tests, build, bundle secret scan, browser e2e, sub-agent review, and preview verification are the acceptance gate before production promotion.
          </div>
        </aside>
      </section>
    </main>
  );
}
