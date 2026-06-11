import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateLeadStatus } from "@/app/dashboard/actions";
import { getLeadDetail } from "@/lib/data/dashboard";

type LeadDetailPageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { leadId } = await params;
  const { workspace, lead, messages } = await getLeadDetail(leadId);

  if (!workspace) redirect("/dashboard/onboarding");
  if (!lead) notFound();

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-5">
        <Link className="text-sm font-semibold text-[#2861a8]" href="/dashboard/leads">Back to leads</Link>
        <h1 className="mt-3 text-3xl font-semibold">{lead.name ?? "Unnamed lead"}</h1>
        <p className="mt-2 text-sm capitalize text-[#657064]">{lead.intent} ? {lead.temperature} ? score {lead.score}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-lg border border-[#d9ded2] bg-white p-4">
          <h2 className="font-semibold">Contact</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Email" value={lead.email} />
            <Row label="Phone" value={lead.phone} />
            <Row label="Area" value={lead.location ?? lead.property_address} />
            <Row label="Timeline" value={lead.timeframe} />
            <Row label="Budget" value={lead.budget_max ? `$${lead.budget_max.toLocaleString()}` : null} />
            <Row label="Property" value={lead.property_type} />
          </dl>

          <form action={updateLeadStatus} className="mt-5 border-t border-[#e5e9df] pt-4">
            <input name="leadId" type="hidden" value={lead.id} />
            <label className="block text-sm font-medium" htmlFor="status">Status</label>
            <select className="mt-1 h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={lead.status} id="status" name="status">
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
              <option value="spam">Spam</option>
            </select>
            <button className="mt-3 h-11 w-full rounded-md bg-[#173f2f] px-4 font-semibold text-white" type="submit">
              Update status
            </button>
          </form>
        </aside>

        <section className="rounded-lg border border-[#d9ded2] bg-white">
          <div className="border-b border-[#e5e9df] p-4">
            <h2 className="font-semibold">Transcript</h2>
            <p className="text-sm text-[#657064]">{lead.summary}</p>
          </div>
          <div className="space-y-3 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-[#657064]">No messages stored yet.</p>
            ) : (
              messages.map((message) => (
                <div className={message.sender_type === "bot" ? "ml-auto max-w-[82%] rounded-lg bg-[#173f2f] px-4 py-3 text-white" : "max-w-[82%] rounded-lg border border-[#d9ded2] bg-[#f7f9f4] px-4 py-3"} key={message.id}>
                  <p className="mb-1 font-mono text-xs uppercase opacity-70">{message.sender_type}</p>
                  <p className="text-sm leading-6">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[#657064]">{label}</dt>
      <dd className="mt-1 font-medium">{value || "Pending"}</dd>
    </div>
  );
}
