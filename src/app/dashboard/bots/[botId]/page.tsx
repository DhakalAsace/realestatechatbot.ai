import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateBot } from "@/app/dashboard/actions";
import { getBotForDashboard } from "@/lib/data/dashboard";

type BotPageProps = {
  params: Promise<{ botId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function BotPage({ params, searchParams }: BotPageProps) {
  const [{ botId }, query] = await Promise.all([params, searchParams]);
  const { workspace, bot } = await getBotForDashboard(botId);

  if (!workspace) redirect("/dashboard/onboarding");
  if (!bot) notFound();

  const brandColor = bot.theme?.brandColor ?? "#163f2f";

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Bot settings</p>
          <h1 className="mt-2 text-3xl font-semibold">{bot.name}</h1>
        </div>
        <Link className="rounded-md border border-[#cbd5c7] bg-white px-4 py-2 text-sm font-semibold" href={`/c/${bot.slug}`} target="_blank">
          Open /c/{bot.slug}
        </Link>
      </div>

      {query.saved ? <div className="mb-4 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]">Bot saved.</div> : null}
      {query.error ? <div className="mb-4 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">Could not save bot settings.</div> : null}

      <form action={updateBot} className="grid gap-4 rounded-lg border border-[#d9ded2] bg-white p-5 md:grid-cols-2">
        <input name="botId" type="hidden" value={bot.id} />
        <Field label="Bot name" name="name" defaultValue={bot.name} />
        <Field label="Slug" name="slug" defaultValue={bot.slug} />
        <label>
          <span className="mb-1 block text-sm font-medium">Status</span>
          <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={bot.status} name="status">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <Field label="Brand color" name="brandColor" defaultValue={brandColor} type="color" />
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Greeting</span>
          <textarea className="min-h-28 w-full rounded-md border border-[#cdd5c8] p-3" defaultValue={bot.greeting} name="greeting" required />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Fallback message</span>
          <textarea className="min-h-28 w-full rounded-md border border-[#cdd5c8] p-3" defaultValue={bot.fallback_message} name="fallbackMessage" required />
        </label>
        <div className="md:col-span-2">
          <button className="h-12 rounded-md bg-[#173f2f] px-5 font-semibold text-white" type="submit">
            Save bot
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue: string; type?: string }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3 outline-none focus:border-[#2861a8]" defaultValue={defaultValue} name={name} required type={type} />
    </label>
  );
}
