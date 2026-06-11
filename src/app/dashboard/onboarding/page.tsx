import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/dashboard/actions";
import { getDashboardContext } from "@/lib/data/dashboard";

type OnboardingPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ workspace }, params] = await Promise.all([getDashboardContext(), searchParams]);

  if (workspace) redirect("/dashboard");

  const errorMessage = getOnboardingErrorMessage(params);
  const defaultBotSlug = params.suggestedSlug ?? "sarah-patel";

  return (
    <main className="mx-auto max-w-4xl px-5 py-6">
      <div className="rounded-lg border border-[#d9ded2] bg-white p-5 md:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">First workspace</p>
        <h1 className="mt-2 text-3xl font-semibold">Set up the sample agent bot</h1>
        <p className="mt-2 text-sm leading-6 text-[#657064]">
          These defaults create the Sarah Patel hosted bot at /c/sarah-patel for Phase 1 review.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">
            {errorMessage}
          </div>
        ) : null}

        <form action={completeOnboarding} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Agent name" name="displayName" defaultValue="Sarah Patel" />
          <Field label="Brokerage" name="brokerageName" defaultValue="Northline Realty" />
          <Field label="Email" name="email" defaultValue="sarah.patel@example.com" type="email" />
          <Field label="Phone" name="phone" defaultValue="+1 204 555 0134" />
          <Field label="City" name="city" defaultValue="Winnipeg" />
          <Field label="Hosted slug" name="botSlug" defaultValue={defaultBotSlug} />
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Service areas</span>
            <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3 outline-none focus:border-[#2861a8]" name="serviceAreas" defaultValue="Winnipeg, River Heights, St. Vital" required />
          </label>
          <div className="md:col-span-2">
            <button className="h-12 rounded-md bg-[#173f2f] px-5 font-semibold text-white" type="submit">
              Create workspace and bot
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function getOnboardingErrorMessage(params: Record<string, string | undefined>) {
  if (!params.error) return null;

  if (params.error === "duplicate-slug") {
    const slug = params.botSlug ? `/${params.botSlug}` : "that hosted slug";
    const suggestion = params.suggestedSlug ? ` Try ${params.suggestedSlug} instead.` : "";

    return `${slug} is already taken.${suggestion}`;
  }

  if (params.error === "validation") {
    return "Some setup details were invalid. Check the fields and try again.";
  }

  return "Setup could not complete. Check the Supabase connection and try again.";
}

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue: string; type?: string }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3 outline-none focus:border-[#2861a8]" defaultValue={defaultValue} name={name} required type={type} />
    </label>
  );
}
