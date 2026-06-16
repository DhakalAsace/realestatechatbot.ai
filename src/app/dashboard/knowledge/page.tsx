import { redirect } from "next/navigation";
import { createKnowledgeDocument, updateKnowledgeDocument } from "@/app/dashboard/actions";
import { getLibraryContext, type BotRow, type KnowledgeDocumentRow } from "@/lib/data/dashboard";

type KnowledgePageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const [{ workspace, bots, knowledgeDocuments }, query] = await Promise.all([getLibraryContext(), searchParams]);

  if (!workspace || bots.length === 0) redirect("/dashboard/onboarding");

  const activeBot = bots.find((bot) => bot.status === "active") ?? bots[0];
  const message = getMessage(query.saved, query.error);

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Knowledge</p>
        <h1 className="mt-2 text-3xl font-semibold">Controlled FAQ and notes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657064]">
          Add short answers the assistant can use. If a visitor asks something outside these notes, the bot should say the info is not in the agent-provided knowledge.
        </p>
      </div>

      {message ? <div className={message.kind === "success" ? "mb-4 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]" : "mb-4 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]"}>{message.text}</div> : null}

      <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
        <h2 className="font-semibold">Add knowledge</h2>
        <KnowledgeForm action={createKnowledgeDocument} bots={bots} defaultBotId={activeBot.id} submitLabel="Add knowledge" />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Saved knowledge</h2>
          <p className="text-sm text-[#657064]">{knowledgeDocuments.length} total</p>
        </div>
        {knowledgeDocuments.length === 0 ? (
          <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-sm text-[#657064]">No knowledge yet. Add a FAQ or note to ground the bot answers.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {knowledgeDocuments.map((document) => (
              <article className="rounded-lg border border-[#d9ded2] bg-white p-5" key={document.id}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{document.title}</h3>
                    <p className="mt-1 text-sm capitalize text-[#657064]">{document.kind}</p>
                  </div>
                  <span className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-semibold capitalize text-[#455247]">{document.status}</span>
                </div>
                <KnowledgeForm action={updateKnowledgeDocument} bots={bots} document={document} submitLabel="Save knowledge" />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function KnowledgeForm({ action, bots, defaultBotId, document, submitLabel }: { action: (formData: FormData) => void; bots: BotRow[]; defaultBotId?: string; document?: KnowledgeDocumentRow; submitLabel: string }) {
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
      {document ? <input name="documentId" type="hidden" value={document.id} /> : null}
      <label>
        <span className="mb-1 block text-sm font-medium">Bot</span>
        <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={document?.bot_id ?? defaultBotId} name="botId">
          {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Status</span>
        <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={document?.status ?? "active"} name="status">
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Kind</span>
        <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={document?.kind ?? "faq"} name="kind">
          <option value="faq">FAQ</option>
          <option value="note">Note</option>
        </select>
      </label>
      <Field label="Knowledge title" name="title" defaultValue={document?.title} required />
      <label className="md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Question</span>
        <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3" defaultValue={document?.question ?? ""} maxLength={300} name="question" placeholder="Which areas do you serve?" />
      </label>
      <label className="md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Answer</span>
        <textarea className="min-h-28 w-full rounded-md border border-[#cdd5c8] p-3" defaultValue={document?.body ?? ""} maxLength={3000} name="body" required />
      </label>
      <label className="md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Tags</span>
        <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3" defaultValue={document?.tags.join(", ") ?? ""} name="tags" placeholder="areas, valuation, process" />
      </label>
      <div className="md:col-span-2">
        <button className="h-11 rounded-md bg-[#173f2f] px-4 text-sm font-semibold text-white" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, required = false }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3" defaultValue={defaultValue ?? ""} name={name} required={required} />
    </label>
  );
}

function getMessage(saved?: string, error?: string) {
  if (saved) return { kind: "success" as const, text: saved === "created" ? "Knowledge added." : "Knowledge saved." };
  if (error === "limit") return { kind: "error" as const, text: "This workspace has reached the knowledge document limit for its plan." };
  if (error) return { kind: "error" as const, text: "Could not save knowledge. Check required fields, then try again." };
  return null;
}
