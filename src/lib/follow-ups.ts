import { randomBytes } from "node:crypto";
import type { AppointmentType } from "@/lib/appointments";
import type { LeadDraft } from "@/lib/chat/types";
import { hashValue } from "@/lib/security";

export const followUpTriggerTypes = ["buyer_no_booking", "seller_valuation", "showing_request"] as const;
export type FollowUpTriggerType = (typeof followUpTriggerTypes)[number];

export type FollowUpDeliveryResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; providerId?: string }
  | { status: "failed"; reason: string };

type FollowUpEnv = Record<string, string | undefined>;
type Fetcher = (input: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const placeholderPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && emailPattern.test(normalized) ? normalized : null;
}

export function createUnsubscribeToken() {
  return randomBytes(24).toString("base64url");
}

export function hashFollowUpToken(token: string) {
  return hashValue(token.trim());
}

export function renderFollowUpTemplate(template: string, values: Record<string, string | null | undefined>) {
  return template.replace(placeholderPattern, (_match, key: string) => values[key] ?? "").replace(/\\n/g, "\n");
}

export function matchesFollowUpTrigger({
  triggerType,
  lead,
  appointmentTypes = [],
}: {
  triggerType: FollowUpTriggerType;
  lead: LeadDraft;
  appointmentTypes?: AppointmentType[];
}) {
  if (!normalizeEmail(lead.email)) return false;

  if (triggerType === "buyer_no_booking") {
    return lead.intent === "buyer" && !appointmentTypes.some((type) => type === "buyer_consultation" || type === "showing");
  }

  if (triggerType === "seller_valuation") {
    return lead.intent === "seller" && (lead.wantsValuation === true || appointmentTypes.includes("seller_valuation"));
  }

  return appointmentTypes.includes("showing");
}

export async function sendFollowUpEmail({
  recipientEmail,
  subject,
  body,
  unsubscribeUrl,
  env = process.env,
  fetcher = fetch as Fetcher,
}: {
  recipientEmail?: string | null;
  subject: string;
  body: string;
  unsubscribeUrl: string;
  env?: FollowUpEnv;
  fetcher?: Fetcher;
}): Promise<FollowUpDeliveryResult> {
  const enabled = env.FOLLOW_UP_EMAIL_ENABLED === "true";
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  const email = normalizeEmail(recipientEmail);

  if (!enabled) return { status: "skipped", reason: "follow_up_email_disabled" };
  if (!apiKey) return { status: "skipped", reason: "missing_resend_api_key" };
  if (!from) return { status: "skipped", reason: "missing_resend_from_email" };
  if (!email) return { status: "skipped", reason: "missing_lead_email" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text: `${body}\n\nUnsubscribe: ${unsubscribeUrl}`,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return { status: "failed", reason: `resend_${response.status}` };

    const json = await response.json().catch(() => null) as { id?: string } | null;
    return { status: "sent", providerId: json?.id };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" };
  } finally {
    clearTimeout(timeout);
  }
}
