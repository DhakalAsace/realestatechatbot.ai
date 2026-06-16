export const channelTypes = ["hosted_link", "web_embed", "qr_code", "social_link", "campaign"] as const;
export const channelStatuses = ["active", "disabled"] as const;

export type ChannelType = (typeof channelTypes)[number];
export type ChannelStatus = (typeof channelStatuses)[number];

export type UTMInput = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

export type ChannelAttribution = {
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  term: string | null;
  sourceUrl: string | null;
  referrer: string | null;
};

export const channelTypeLabels: Record<ChannelType, string> = {
  hosted_link: "Hosted link",
  web_embed: "Website widget",
  qr_code: "QR code",
  social_link: "Social link",
  campaign: "Campaign",
};

const defaultSource: Record<ChannelType, string> = {
  hosted_link: "hosted",
  web_embed: "website",
  qr_code: "qr",
  social_link: "social",
  campaign: "campaign",
};

const defaultMedium: Record<ChannelType, string> = {
  hosted_link: "link",
  web_embed: "widget",
  qr_code: "qr",
  social_link: "social",
  campaign: "campaign",
};

export const publicChannelKeyPattern = /^[a-f0-9]{32}$/;

export function isChannelType(value: unknown): value is ChannelType {
  return typeof value === "string" && channelTypes.includes(value as ChannelType);
}

export function isPublicChannelKey(value: unknown): value is string {
  return typeof value === "string" && publicChannelKeyPattern.test(value);
}

export function defaultChannelLabel(type: ChannelType) {
  return channelTypeLabels[type];
}

export function defaultChannelSource(type: ChannelType) {
  return defaultSource[type];
}

export function defaultChannelMedium(type: ChannelType) {
  return defaultMedium[type];
}

export function sanitizeSourceText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

export function sanitizeUrl(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().slice(0, maxLength);
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, maxLength);
  } catch {
    return null;
  }
}

export function normalizeAllowedOrigins(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeOrigin(entry)).filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value !== "string") return [];

  return value
    .split(/[\n,]/)
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export function normalizeOrigin(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isSourceUrlAllowed(sourceUrl: string | null | undefined, allowedOrigins: string[]) {
  if (allowedOrigins.length === 0 || !sourceUrl) return false;

  const origin = normalizeOrigin(sourceUrl);
  return Boolean(origin && allowedOrigins.includes(origin));
}

export function buildAttribution({
  channelType,
  channelSource,
  channelMedium,
  channelCampaign,
  channelContent,
  sourceUrl,
  referrer,
  utm,
}: {
  channelType: ChannelType;
  channelSource?: string | null;
  channelMedium?: string | null;
  channelCampaign?: string | null;
  channelContent?: string | null;
  sourceUrl?: string | null;
  referrer?: string | null;
  utm?: UTMInput | null;
}): ChannelAttribution {
  return {
    source: sanitizeSourceText(utm?.source, 80) ?? channelSource ?? defaultChannelSource(channelType),
    medium: sanitizeSourceText(utm?.medium, 80) ?? channelMedium ?? defaultChannelMedium(channelType),
    campaign: sanitizeSourceText(utm?.campaign, 120) ?? channelCampaign ?? null,
    content: sanitizeSourceText(utm?.content, 120) ?? channelContent ?? null,
    term: sanitizeSourceText(utm?.term, 120),
    sourceUrl: sanitizeUrl(sourceUrl),
    referrer: sanitizeUrl(referrer),
  };
}

export function buildChannelUrl(appUrl: string, botSlug: string, publicKey: string) {
  return `${appUrl.replace(/\/$/, "")}/c/${botSlug}?ch=${publicKey}`;
}

export function buildWidgetSnippet(appUrl: string, publicKey: string) {
  return `<script async src="${appUrl.replace(/\/$/, "")}/widget.js?channel=${publicKey}"></script>`;
}

export function sourceDisplayLabel({
  sourceLabel,
  source_label,
  sourceType,
  source_type,
  source,
  medium,
}: {
  sourceLabel?: string | null;
  source_label?: string | null;
  sourceType?: ChannelType | string | null;
  source_type?: ChannelType | string | null;
  source?: string | null;
  medium?: string | null;
}) {
  const label = sourceLabel ?? source_label;
  const type = sourceType ?? source_type;
  if (label) return label;
  if (isChannelType(type)) return channelTypeLabels[type];
  if (source && medium) return `${source} / ${medium}`;
  return "Unattributed";
}
