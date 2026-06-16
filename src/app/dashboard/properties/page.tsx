import { redirect } from "next/navigation";
import { createProperty, updateProperty } from "@/app/dashboard/actions";
import { getLibraryContext, type BotRow, type PropertyRow } from "@/lib/data/dashboard";

type PropertiesPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const [{ workspace, bots, properties }, query] = await Promise.all([getLibraryContext(), searchParams]);

  if (!workspace || bots.length === 0) redirect("/dashboard/onboarding");

  const activeBot = bots.find((bot) => bot.status === "active") ?? bots[0];
  const message = getMessage(query.saved, query.error);

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Properties</p>
          <h1 className="mt-2 text-3xl font-semibold">Controlled property library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657064]">
            Add only properties the agent wants the assistant to mention. Public chat can show these cards, but it will not invent unavailable listings.
          </p>
        </div>
      </div>

      {message ? <div className={message.kind === "success" ? "mb-4 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]" : "mb-4 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]"}>{message.text}</div> : null}

      <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
        <h2 className="font-semibold">Add property</h2>
        <PropertyForm action={createProperty} bots={bots} defaultBotId={activeBot.id} submitLabel="Add property" />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Saved properties</h2>
          <p className="text-sm text-[#657064]">{properties.length} total</p>
        </div>
        {properties.length === 0 ? (
          <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-sm text-[#657064]">No properties yet. Add one active property to let the bot show controlled cards.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {properties.map((property) => (
              <article className="rounded-lg border border-[#d9ded2] bg-white p-5" key={property.id}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{property.title}</h3>
                    <p className="mt-1 text-sm text-[#657064]">{property.area || property.city || "Location pending"}</p>
                  </div>
                  <span className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-semibold capitalize text-[#455247]">{property.status}</span>
                </div>
                <PropertyForm action={updateProperty} bots={bots} property={property} submitLabel="Save property" />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PropertyForm({ action, bots, defaultBotId, property, submitLabel }: { action: (formData: FormData) => void; bots: BotRow[]; defaultBotId?: string; property?: PropertyRow; submitLabel: string }) {
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
      {property ? <input name="propertyId" type="hidden" value={property.id} /> : null}
      <label>
        <span className="mb-1 block text-sm font-medium">Bot</span>
        <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={property?.bot_id ?? defaultBotId} name="botId">
          {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Status</span>
        <select className="h-11 w-full rounded-md border border-[#cdd5c8] bg-white px-3" defaultValue={property?.status ?? "active"} name="status">
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <Field label="Property title" name="title" defaultValue={property?.title} required />
      <Field label="Property type" name="propertyType" defaultValue={property?.property_type ?? undefined} placeholder="House, condo, townhouse" />
      <Field label="Price" name="price" defaultValue={property?.price?.toString()} inputMode="numeric" placeholder="780000" />
      <Field label="Area" name="area" defaultValue={property?.area ?? undefined} placeholder="River Heights" />
      <Field label="City" name="city" defaultValue={property?.city ?? undefined} placeholder="Winnipeg" />
      <Field label="Address" name="address" defaultValue={property?.address ?? undefined} />
      <Field label="Bedrooms" name="bedrooms" defaultValue={property?.bedrooms?.toString()} inputMode="numeric" />
      <Field label="Bathrooms" name="bathrooms" defaultValue={property?.bathrooms?.toString()} inputMode="decimal" />
      <Field label="Image URL" name="imageUrl" defaultValue={property?.image_url ?? undefined} placeholder="https://..." />
      <Field label="Listing URL" name="listingUrl" defaultValue={property?.listing_url ?? undefined} placeholder="https://..." />
      <label className="md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Description</span>
        <textarea className="min-h-24 w-full rounded-md border border-[#cdd5c8] p-3" defaultValue={property?.description ?? ""} maxLength={2000} name="description" />
      </label>
      <label className="md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Highlights</span>
        <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3" defaultValue={property?.highlights.join(", ") ?? ""} name="highlights" placeholder="garage, finished basement, near parks" />
      </label>
      <div className="md:col-span-2">
        <button className="h-11 rounded-md bg-[#173f2f] px-4 text-sm font-semibold text-white" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, required = false, placeholder, inputMode }: { label: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string; inputMode?: "numeric" | "decimal" }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="h-11 w-full rounded-md border border-[#cdd5c8] px-3" defaultValue={defaultValue ?? ""} inputMode={inputMode} name={name} placeholder={placeholder} required={required} />
    </label>
  );
}

function getMessage(saved?: string, error?: string) {
  if (saved) return { kind: "success" as const, text: saved === "created" ? "Property added." : "Property saved." };
  if (error) return { kind: "error" as const, text: "Could not save property. Check required fields and URLs, then try again." };
  return null;
}
