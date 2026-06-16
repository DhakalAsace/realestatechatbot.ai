import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createChannel, updateChannel } from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { buildChannelUrl, buildWidgetSnippet, channelTypeLabels, channelTypes } from "@/lib/channels";
import { getDashboardContext, type ChannelRow } from "@/lib/data/dashboard";
import { getAppUrl } from "@/lib/env";

type ChannelsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const errorText: Record<string, string> = {
  validation: "Check the channel fields and try again.",
  bot: "The selected bot was not found.",
  channel: "The selected channel was not found.",
  create: "The channel could not be created.",
  update: "The channel could not be updated.",
  origins: "Website widget channels need at least one allowed origin.",
};
const fieldClass = "h-11 w-full rounded-md border border-[#cbd5c7] bg-white px-3 outline-none focus:border-[#2861a8]";
const textareaClass = "w-full rounded-md border border-[#cbd5c7] bg-white px-3 outline-none focus:border-[#2861a8]";

export default async function ChannelsPage({ searchParams }: ChannelsPageProps) {
  const [{ workspace, profile, bots, channels }, params] = await Promise.all([getDashboardContext(), searchParams]);

  if (!workspace || !profile || bots.length === 0) {
    redirect("/dashboard/onboarding");
  }

  const activeBot = bots.find((bot) => bot.status === "active") ?? bots[0];
  const botChannels = channels.filter((channel) => channel.bot_id === activeBot.id);
  const activeHostedChannel = botChannels.find((channel) => channel.type === "hosted_link" && channel.status === "active");
  const appUrl = getAppUrl();
  const error = params.error ? errorText[params.error] ?? "Something went wrong." : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Channels</p>
          <h1 className="mt-2 text-3xl font-semibold">Share and track your bot</h1>
          <p className="mt-2 text-sm text-[#657064]">Create separate links for hosted pages, websites, QR codes, social posts, and campaigns.</p>
        </div>
        {activeHostedChannel ? (
          <Link className="rounded-md border border-[#cbd5c7] bg-white px-4 py-2 text-sm font-semibold" href={`/c/${activeBot.slug}`} target="_blank">
            Open default link
          </Link>
        ) : (
          <span className="rounded-md border border-[#efc7b8] bg-[#fff7f3] px-4 py-2 text-sm font-semibold text-[#8a3518]">
            No active hosted link
          </span>
        )}
      </div>

      {error ? <p className="mb-4 rounded-md bg-[#fff1eb] px-4 py-3 text-sm font-medium text-[#8a3518]">{error}</p> : null}
      {params.saved ? <p className="mb-4 rounded-md bg-[#eaf5ec] px-4 py-3 text-sm font-medium text-[#173f2f]">Channel saved.</p> : null}

      <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
        <h2 className="font-semibold">Create channel</h2>
        <form action={createChannel} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input name="botId" type="hidden" value={activeBot.id} />
          <Field label="New channel label">
            <input className={fieldClass} name="label" placeholder="Spring open house QR" required />
          </Field>
          <Field label="New channel type">
            <select className={fieldClass} defaultValue="campaign" name="type">
              {channelTypes.map((type) => (
                <option key={type} value={type}>
                  {channelTypeLabels[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New source">
            <input className={fieldClass} name="source" placeholder="spring-open-house" />
          </Field>
          <Field label="New medium">
            <input className={fieldClass} name="medium" placeholder="qr" />
          </Field>
          <Field label="New campaign">
            <input className={fieldClass} name="campaign" placeholder="2026-spring" />
          </Field>
          <Field label="New content">
            <input className={fieldClass} name="content" placeholder="yard-sign" />
          </Field>
          <Field className="md:col-span-2" label="Allowed origins for widget">
            <textarea className={`${textareaClass} min-h-24 py-3`} name="allowedOrigins" placeholder="https://example.com&#10;https://www.example.com" />
          </Field>
          <div className="flex items-end">
            <button className="h-11 rounded-md bg-[#173f2f] px-4 font-semibold text-white" type="submit">
              Create channel
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 grid gap-4">
        {botChannels.length === 0 ? (
          <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-sm text-[#657064]">No channels yet.</div>
        ) : (
          botChannels.map((channel) => <ChannelCard appUrl={appUrl} botSlug={activeBot.slug} channel={channel} key={channel.id} />)
        )}
      </section>
    </main>
  );
}

function ChannelCard({ appUrl, botSlug, channel }: { appUrl: string; botSlug: string; channel: ChannelRow }) {
  const shareUrl = buildChannelUrl(appUrl, botSlug, channel.public_key);
  const snippet = buildWidgetSnippet(appUrl, channel.public_key);
  const qrUrl = `/api/channels/${channel.id}/qr.svg`;
  const qrFileName = `${botSlug}-${fileSafeLabel(channel.label)}.svg`;
  const isActive = channel.status === "active";

  return (
    <article className="rounded-lg border border-[#d9ded2] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e5e9df] p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{channel.label}</h2>
            <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-xs font-semibold text-[#4c5a49]">{channelTypeLabels[channel.type]}</span>
            <span className={isActive ? "rounded-full bg-[#dfe9f7] px-2.5 py-1 text-xs font-semibold capitalize text-[#204f8a]" : "rounded-full bg-[#fff1eb] px-2.5 py-1 text-xs font-semibold capitalize text-[#8a3518]"}>{channel.status}</span>
          </div>
          <p className="mt-2 text-sm text-[#657064]">
            {channel.source} / {channel.medium}
            {channel.campaign ? ` / ${channel.campaign}` : ""}
          </p>
        </div>
        {isActive ? (
          <Link className="w-fit rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href={shareUrl} target="_blank">
            Open link
          </Link>
        ) : (
          <span className="w-fit rounded-md border border-[#efc7b8] bg-[#fff7f3] px-4 py-2 text-sm font-semibold text-[#8a3518]">
            Inactive
          </span>
        )}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Field label="Share URL">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${fieldClass} font-mono text-xs`} readOnly value={shareUrl} />
              {isActive ? <CopyButton label="Copy URL" value={shareUrl} /> : <InactiveAction label="Inactive" />}
            </div>
            {!isActive ? <InactiveNotice text="Enable this channel before sharing its public URL." /> : null}
          </Field>

          {channel.type === "web_embed" ? (
            <Field label="Website widget snippet">
              <div className="space-y-2">
                <textarea className={`${textareaClass} min-h-24 py-3 font-mono text-xs`} readOnly value={snippet} />
                {isActive ? <CopyButton label="Copy snippet" value={snippet} /> : <InactiveAction label="Inactive" />}
                {!isActive ? <InactiveNotice text="Enable this widget channel before installing or copying its snippet." /> : null}
              </div>
            </Field>
          ) : null}

          <form action={updateChannel} className="grid gap-4 md:grid-cols-2">
            <input name="channelId" type="hidden" value={channel.id} />
            <Field label="Label">
              <input className={fieldClass} name="label" required defaultValue={channel.label} />
            </Field>
            <Field label="Status">
              <select className={fieldClass} name="status" defaultValue={channel.status}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </Field>
            <Field label="Source">
              <input className={fieldClass} name="source" defaultValue={channel.source} />
            </Field>
            <Field label="Medium">
              <input className={fieldClass} name="medium" defaultValue={channel.medium} />
            </Field>
            <Field label="Campaign">
              <input className={fieldClass} name="campaign" defaultValue={channel.campaign ?? ""} />
            </Field>
            <Field label="Content">
              <input className={fieldClass} name="content" defaultValue={channel.content ?? ""} />
            </Field>
            <Field className="md:col-span-2" label="Allowed origins">
              <textarea className={`${textareaClass} min-h-24 py-3`} name="allowedOrigins" defaultValue={(channel.allowed_origins ?? []).join("\n")} />
            </Field>
            <div className="md:col-span-2">
              <button className="h-11 rounded-md border border-[#cbd5c7] bg-white px-4 font-semibold" type="submit">
                Save channel
              </button>
            </div>
          </form>
        </div>

        <aside className="rounded-md bg-[#f7f9f4] p-4">
          {channel.type === "qr_code" ? (
            <>
              <p className="mb-3 text-sm font-semibold">QR preview</p>
              {channel.status === "active" ? (
                <Image alt={`${channel.label} QR code`} className="h-auto w-full rounded-md bg-white p-3" height={512} src={qrUrl} unoptimized width={512} />
              ) : (
                <div className="rounded-md bg-white p-5 text-sm text-[#657064]">Enable this QR channel to generate its SVG.</div>
              )}
              {isActive ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton label="Copy QR URL" value={`${appUrl}${qrUrl}`} />
                  <a className="inline-flex h-11 items-center rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold" download={qrFileName} href={qrUrl}>
                    Download SVG
                  </a>
                  <a className="inline-flex h-11 items-center rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold" href={qrUrl} target="_blank">
                    Open SVG
                  </a>
                </div>
              ) : (
                <InactiveNotice text="QR actions are inactive until this channel is enabled." />
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Public channel key</p>
              <p className="mt-2 break-all rounded-md bg-white p-3 font-mono text-xs">{channel.public_key}</p>
              <p className="mt-4 text-sm leading-6 text-[#657064]">
                Use this key only in public links or snippets. It cannot read private dashboard data.
              </p>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}

function InactiveAction({ label }: { label: string }) {
  return (
    <span className="inline-flex h-11 items-center rounded-md border border-[#efc7b8] bg-[#fff7f3] px-3 text-sm font-semibold text-[#8a3518]">
      {label}
    </span>
  );
}

function InactiveNotice({ text }: { text: string }) {
  return <p className="mt-2 rounded-md bg-[#fff7f3] px-3 py-2 text-sm text-[#8a3518]">{text}</p>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className ? `block text-sm font-medium ${className}` : "block text-sm font-medium"}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function fileSafeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "channel";
}
