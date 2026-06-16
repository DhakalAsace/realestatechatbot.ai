import type { AppointmentRequest } from "@/lib/appointments";
import { appointmentTypeLabel } from "@/lib/appointments";
import type { LeadDraft } from "@/lib/chat/types";

export type AppointmentNotificationResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; providerId?: string }
  | { status: "failed"; reason: string };

type NotificationEnv = Record<string, string | undefined>;

type Fetcher = (input: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

export async function sendAppointmentNotification({
  appointment,
  lead,
  recipientEmail,
  botName,
  calendarUrl,
  env = process.env,
  fetcher = fetch as Fetcher,
}: {
  appointment: AppointmentRequest;
  lead: LeadDraft;
  recipientEmail?: string | null;
  botName: string;
  calendarUrl?: string | null;
  env?: NotificationEnv;
  fetcher?: Fetcher;
}): Promise<AppointmentNotificationResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) return { status: "skipped", reason: "missing_resend_api_key" };
  if (!from) return { status: "skipped", reason: "missing_resend_from_email" };
  if (!recipientEmail) return { status: "skipped", reason: "missing_agent_email" };

  const subject = `New ${appointmentTypeLabel(appointment.type)} request`;
  const body = buildAppointmentEmailText({ appointment, lead, botName, calendarUrl });
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
        to: [recipientEmail],
        subject,
        text: body,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "failed", reason: `resend_${response.status}` };
    }

    const json = await response.json().catch(() => null) as { id?: string } | null;
    return { status: "sent", providerId: json?.id };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAppointmentEmailText({ appointment, lead, botName, calendarUrl }: { appointment: AppointmentRequest; lead: LeadDraft; botName: string; calendarUrl?: string | null }) {
  const lines = [
    `${botName} captured a new ${appointmentTypeLabel(appointment.type)} request.`,
    "",
    `Requested time: ${appointment.requestedWindow}`,
    lead.name ? `Lead: ${lead.name}` : undefined,
    lead.email ? `Email: ${lead.email}` : undefined,
    lead.phone ? `Phone: ${lead.phone}` : undefined,
    lead.location ? `Area: ${lead.location}` : undefined,
    lead.propertyAddress ? `Property/address: ${lead.propertyAddress}` : undefined,
    appointment.notes ? `Notes: ${appointment.notes}` : undefined,
    calendarUrl ? `Calendar: ${calendarUrl}` : undefined,
  ].filter(Boolean);

  return lines.join("\n");
}
