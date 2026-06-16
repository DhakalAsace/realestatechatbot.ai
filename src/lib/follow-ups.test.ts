import { describe, expect, it } from "vitest";
import {
  createUnsubscribeToken,
  hashFollowUpToken,
  matchesFollowUpTrigger,
  normalizeEmail,
  renderFollowUpTemplate,
  sendFollowUpEmail,
} from "@/lib/follow-ups";

describe("follow-up helpers", () => {
  it("normalizes valid email and rejects invalid email", () => {
    expect(normalizeEmail(" Maya@Example.COM ")).toBe("maya@example.com");
    expect(normalizeEmail("not an email")).toBeNull();
  });

  it("creates opaque unsubscribe tokens and hashes without storing plaintext", () => {
    const token = createUnsubscribeToken();
    expect(token).toHaveLength(32);
    expect(hashFollowUpToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashFollowUpToken(token)).not.toBe(token);
  });

  it("renders known template placeholders and blanks unknown values", () => {
    expect(renderFollowUpTemplate("Hi {{ lead_name }}, {{area}} {{missing}}", { lead_name: "Maya", area: "Winnipeg" })).toBe("Hi Maya, Winnipeg ");
    expect(renderFollowUpTemplate("Line 1\\nLine 2", {})).toBe("Line 1\nLine 2");
  });

  it("matches buyer follow-up only when no appointment was booked", () => {
    const lead = { intent: "buyer" as const, email: "buyer@example.com" };
    expect(matchesFollowUpTrigger({ triggerType: "buyer_no_booking", lead, appointmentTypes: [] })).toBe(true);
    expect(matchesFollowUpTrigger({ triggerType: "buyer_no_booking", lead, appointmentTypes: ["buyer_consultation"] })).toBe(false);
    expect(matchesFollowUpTrigger({ triggerType: "buyer_no_booking", lead: { ...lead, email: "bad" }, appointmentTypes: [] })).toBe(false);
  });

  it("matches seller valuation and showing workflows deterministically", () => {
    expect(matchesFollowUpTrigger({ triggerType: "seller_valuation", lead: { intent: "seller", email: "seller@example.com", wantsValuation: true } })).toBe(true);
    expect(matchesFollowUpTrigger({ triggerType: "seller_valuation", lead: { intent: "seller", email: "seller@example.com" }, appointmentTypes: ["seller_valuation"] })).toBe(true);
    expect(matchesFollowUpTrigger({ triggerType: "showing_request", lead: { intent: "buyer", email: "buyer@example.com" }, appointmentTypes: ["showing"] })).toBe(true);
  });

  it("skips delivery unless follow-up email is explicitly enabled", async () => {
    await expect(sendFollowUpEmail({ recipientEmail: "lead@example.com", subject: "Hi", body: "Body", unsubscribeUrl: "https://example.com/u" })).resolves.toEqual({
      status: "skipped",
      reason: "follow_up_email_disabled",
    });
  });

  it("sends through Resend when enabled and configured", async () => {
    const calls: RequestInit[] = [];
    const result = await sendFollowUpEmail({
      recipientEmail: "lead@example.com",
      subject: "Follow up",
      body: "Hello",
      unsubscribeUrl: "https://example.com/unsubscribe/token",
      env: { FOLLOW_UP_EMAIL_ENABLED: "true", RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "agent@example.com" },
      fetcher: async (_input, init) => {
        calls.push(init);
        return { ok: true, status: 200, json: async () => ({ id: "email_456" }), text: async () => "" };
      },
    });

    expect(result).toEqual({ status: "sent", providerId: "email_456" });
    expect(calls[0].headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(String(calls[0].body)).toContain("List-Unsubscribe");
  });
});
