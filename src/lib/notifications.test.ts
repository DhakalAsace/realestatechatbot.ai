import { describe, expect, it } from "vitest";
import { buildAppointmentEmailText, sendAppointmentNotification } from "@/lib/notifications";

const appointment = { type: "buyer_consultation" as const, requestedWindow: "tomorrow afternoon" };
const lead = { intent: "buyer" as const, name: "Maya Chen", email: "maya@example.com", location: "River Heights" };

describe("appointment notifications", () => {
  it("skips when provider credentials are missing", async () => {
    await expect(sendAppointmentNotification({ appointment, lead, recipientEmail: "agent@example.com", botName: "Sarah" })).resolves.toEqual({
      status: "skipped",
      reason: "missing_resend_api_key",
    });
  });

  it("sends through Resend when configured", async () => {
    const calls: RequestInit[] = [];
    const result = await sendAppointmentNotification({
      appointment,
      lead,
      recipientEmail: "agent@example.com",
      botName: "Sarah",
      env: { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "bot@example.com" },
      fetcher: async (_input, init) => {
        calls.push(init);
        return { ok: true, status: 200, json: async () => ({ id: "email_123" }), text: async () => "" };
      },
    });

    expect(result).toEqual({ status: "sent", providerId: "email_123" });
    expect(calls[0].headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("records provider failures without throwing", async () => {
    const result = await sendAppointmentNotification({
      appointment,
      lead,
      recipientEmail: "agent@example.com",
      botName: "Sarah",
      env: { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "bot@example.com" },
      fetcher: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "failure" }),
    });

    expect(result).toEqual({ status: "failed", reason: "resend_500" });
  });

  it("builds appointment email text", () => {
    const text = buildAppointmentEmailText({ appointment, lead, botName: "Sarah", calendarUrl: "https://calendly.com/sarah" });
    expect(text).toContain("buyer consultation");
    expect(text).toContain("tomorrow afternoon");
    expect(text).toContain("maya@example.com");
    expect(text).toContain("https://calendly.com/sarah");
  });
});
