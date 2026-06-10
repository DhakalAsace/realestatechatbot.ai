import Link from "next/link";

const checkpoints = [
  "Supabase email magic-link auth",
  "Workspace, agent profile, and hosted bot setup",
  "Deterministic buyer and seller lead capture",
  "Dashboard lead inbox with transcript and score",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#162018]">
      <header className="border-b border-[#d9ded2] bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Phase 1 build</p>
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
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Hosted lead assistant</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            Turn real estate traffic into qualified appointments 24/7.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#657064]">
            Phase 1 is the core product loop: an agent signs in, creates a hosted chatbot, a visitor completes a buyer or seller flow, and the lead appears in the dashboard with a transcript and score.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-md bg-[#173f2f] px-5 py-3 text-sm font-semibold text-white" href="/login">
              Start dashboard setup
            </Link>
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-5 py-3 text-sm font-semibold" href="/c/sarah-patel">
              Open /c/sarah-patel
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-[#d9ded2] bg-white p-5">
          <h3 className="font-semibold">Phase 1 checklist</h3>
          <div className="mt-4 space-y-3">
            {checkpoints.map((item) => (
              <div className="flex gap-3 rounded-md bg-[#f7f9f4] p-3" key={item}>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2861a8]" />
                <p className="text-sm leading-6">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md bg-[#fff5df] p-3 text-sm leading-6 text-[#6c4b0b]">
            Supabase is connected. Sign in, finish onboarding, then open /c/sarah-patel to capture review leads.
          </div>
        </aside>
      </section>
    </main>
  );
}
