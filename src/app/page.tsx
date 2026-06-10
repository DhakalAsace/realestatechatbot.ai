const leadRows = [
  {
    name: "Maya Chen",
    intent: "Buyer",
    area: "River Heights",
    budget: "$475k",
    score: 86,
    status: "Hot",
  },
  {
    name: "Owen Singh",
    intent: "Seller",
    area: "St. Vital",
    budget: "Valuation",
    score: 74,
    status: "Warm",
  },
];

const messages = [
  {
    role: "Visitor",
    text: "I am looking for a 3 bed home under 500k in Winnipeg this summer.",
  },
  {
    role: "Assistant",
    text: "Great. Are you already pre-approved, or would you like the agent to connect you with a mortgage contact?",
  },
  {
    role: "Visitor",
    text: "Pre-approved. I would like to see options in River Heights.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17201a]">
      <header className="border-b border-[#d8ded3] bg-white/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5d766b]">
              Phase 1
            </p>
            <h1 className="text-xl font-semibold">RealEstateChatbot.ai</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-[#163f2f] px-3 py-1.5 text-white">
              Hosted Chat
            </span>
            <span className="rounded-full border border-[#c9d2c5] bg-white px-3 py-1.5">
              Lead Inbox
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <section className="rounded-lg border border-[#d8ded3] bg-white p-4">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-[#5d766b]">
              Bot Setup
            </h2>
            <span className="rounded-full bg-[#f2c36b] px-2.5 py-1 text-xs font-medium text-[#3b2b06]">
              Draft
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#6f786c]">Agent</p>
              <p className="font-medium">Sarah Patel</p>
            </div>
            <div>
              <p className="text-xs text-[#6f786c]">Brokerage</p>
              <p className="font-medium">Northline Realty</p>
            </div>
            <div>
              <p className="text-xs text-[#6f786c]">Service Areas</p>
              <p className="font-medium">Winnipeg, River Heights, St. Vital</p>
            </div>
            <div>
              <p className="text-xs text-[#6f786c]">Primary Goal</p>
              <p className="font-medium">Buyer and seller leads</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#d8ded3] bg-white">
          <div className="flex items-center justify-between border-b border-[#e3e7df] px-4 py-3">
            <div>
              <h2 className="font-semibold">Hosted Chat Preview</h2>
              <p className="text-sm text-[#6f786c]">/c/sarah-patel</p>
            </div>
            <span className="rounded-full bg-[#d9ebe2] px-2.5 py-1 text-xs font-medium text-[#163f2f]">
              Active
            </span>
          </div>

          <div className="space-y-3 p-4">
            {messages.map((message) => (
              <div
                className={
                  message.role === "Assistant"
                    ? "ml-auto max-w-[82%] rounded-lg bg-[#163f2f] px-4 py-3 text-white"
                    : "max-w-[82%] rounded-lg border border-[#d8ded3] bg-[#f8faf6] px-4 py-3"
                }
                key={message.text}
              >
                <p className="mb-1 font-mono text-xs opacity-70">
                  {message.role}
                </p>
                <p className="text-sm leading-6">{message.text}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-[#e3e7df] p-4">
            <div className="flex min-h-12 items-center justify-between rounded-lg border border-[#c9d2c5] bg-[#fbfcfa] px-4 text-sm text-[#6f786c]">
              <span>Ask about buying, selling, valuation, or a showing</span>
              <span className="font-medium text-[#2861a8]">Send</span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#d8ded3] bg-white">
          <div className="border-b border-[#e3e7df] px-4 py-3">
            <h2 className="font-semibold">Lead Inbox</h2>
            <p className="text-sm text-[#6f786c]">Qualified conversations</p>
          </div>

          <div className="divide-y divide-[#e3e7df]">
            {leadRows.map((lead) => (
              <article className="p-4" key={lead.name}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{lead.name}</h3>
                    <p className="text-sm text-[#6f786c]">
                      {lead.intent} · {lead.area}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#dfe9f7] px-2.5 py-1 text-xs font-medium text-[#204f8a]">
                    {lead.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-[#f8faf6] p-3">
                    <p className="text-xs text-[#6f786c]">Budget</p>
                    <p className="font-semibold">{lead.budget}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faf6] p-3">
                    <p className="text-xs text-[#6f786c]">Score</p>
                    <p className="font-semibold">{lead.score}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
