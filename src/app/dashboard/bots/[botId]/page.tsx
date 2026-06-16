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
  const { workspace, bot, profile, agentProfiles } = await getBotForDashboard(botId);

  if (!workspace) redirect("/dashboard/onboarding");
  if (!bot) notFound();

  const brandColor = bot.theme?.brandColor ?? "#163f2f";
  const calendarUrl = bot.appointment_config?.calendarUrl ?? "";
  const assignedProfile = agentProfiles.find((agentProfile) => agentProfile.id === bot.agent_profile_id) ?? profile;
  const agentCalendarUrl = assignedProfile?.calendar_url ?? "";
  const errorMessage = getBotErrorMessage(query.error);

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
      {errorMessage ? <div className="mb-4 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">{errorMessage}</div> : null}

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
        <label>
          <span className="mb-1 block text-sm font-medium">Assigned profile</span>
          <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={bot.agent_profile_id ?? ""} name="assignedProfileId">
            <option value="">No routing profile</option>
            {agentProfiles.filter((agentProfile) => agentProfile.status === "active").map((agentProfile) => (
              <option key={agentProfile.id} value={agentProfile.id}>
                {agentProfile.display_name} ({agentProfile.profile_type})
              </option>
            ))}
          </select>
        </label>
        <Field label="Brand color" name="brandColor" defaultValue={brandColor} type="color" />
        <label className="flex items-start gap-3 rounded-md border border-[#d9ded2] bg-[#f8faf6] p-4 md:col-span-2">
          <input className="mt-1 h-4 w-4 accent-[#173f2f]" defaultChecked={bot.ai_enabled} name="aiEnabled" type="checkbox" />
          <span>
            <span className="block text-sm font-semibold">AI-assisted replies</span>
            <span className="mt-1 block text-sm leading-6 text-[#657064]">
              OpenAI can polish the assistant reply while the app still controls lead fields, scoring, safety fallback, and persistence.
            </span>
          </span>
        </label>
        <Field label="Bot calendar URL" name="calendarUrl" defaultValue={calendarUrl} placeholder="https://calendly.com/..." required={false} />
        <Field label="Agent fallback calendar URL" name="agentCalendarUrl" defaultValue={agentCalendarUrl} placeholder="https://calendly.com/..." required={false} />
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

function getBotErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "duplicate-slug") return "That hosted slug is already taken. Choose another slug and save again.";
  if (error === "calendar") return "Could not save the calendar URL. Use a valid http or https link.";

  return "Could not save bot settings.";
}

function Field({ label, name, defaultValue, type = "text", placeholder, required = true }: { label: string; name: string; defaultValue: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3 outline-none focus:border-[#2861a8]" defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}
