import { describe, expect, it, vi } from "vitest";
import { billingPlans } from "@/lib/billing/plans";

vi.mock("server-only", () => ({}));

describe("billing entitlement decisions", () => {
  it("allows active and trialing subscriptions within limits", async () => {
    const { decideEntitlement } = await import("@/lib/billing/entitlements");

    expect(decideEntitlement({ feature: "channels", plan: billingPlans.starter, status: "active", used: 49 }).allowed).toBe(true);
    expect(decideEntitlement({ feature: "monthly_ai_messages", plan: billingPlans.pro, status: "trialing", used: 9999 }).allowed).toBe(true);
  });

  it("blocks exactly over the configured limit", async () => {
    const { decideEntitlement } = await import("@/lib/billing/entitlements");
    const decision = decideEntitlement({ feature: "channels", plan: billingPlans.free, status: "free", used: billingPlans.free.limits.channels });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("limit_reached");
    expect(decision.remaining).toBe(0);
  });

  it("blocks costly actions for inactive billing states", async () => {
    const { decideEntitlement } = await import("@/lib/billing/entitlements");

    expect(decideEntitlement({ feature: "monthly_chat_turns", plan: billingPlans.starter, status: "past_due", used: 1 }).reason).toBe("subscription_inactive");
    expect(decideEntitlement({ feature: "monthly_chat_turns", plan: billingPlans.starter, status: "unpaid", used: 1 }).allowed).toBe(false);
  });

  it("allows canceled subscriptions through a future period end", async () => {
    const { decideEntitlement } = await import("@/lib/billing/entitlements");
    const now = new Date("2026-06-16T00:00:00.000Z");
    const future = "2026-07-01T00:00:00.000Z";
    const past = "2026-06-01T00:00:00.000Z";

    expect(decideEntitlement({ feature: "channels", plan: billingPlans.starter, status: "canceled", used: 1, periodEnd: future, now }).allowed).toBe(true);
    expect(decideEntitlement({ feature: "channels", plan: billingPlans.starter, status: "canceled", used: 1, periodEnd: past, now }).reason).toBe("subscription_inactive");
  });

  it("records usage through the atomic reservation RPC", async () => {
    const { recordUsageEvent } = await import("@/lib/billing/entitlements");
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const admin = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return Promise.resolve({ data: [{ allowed: true, used: 3, limit_value: 500, idempotent: false, usage_event_id: "usage-1", reason: null }], error: null });
      },
    } as never;

    const result = await recordUsageEvent(admin, {
      workspaceId: "workspace-1",
      eventType: "chat_turn",
      sourceType: "conversation",
      sourceId: "00000000-0000-0000-0000-000000000001",
      idempotencyKey: "chat_turn:test:1",
      metadata: { botId: "bot-1" },
    });

    expect(result).toMatchObject({ ok: true, allowed: true, used: 3, limit: 500 });
    expect(calls[0].name).toBe("reserve_usage_event");
    expect(calls[0].args.p_event_type).toBe("chat_turn");
  });

  it("returns a clean denial when the atomic reservation RPC rejects usage", async () => {
    const { recordUsageEvent } = await import("@/lib/billing/entitlements");
    const admin = {
      rpc() {
        return Promise.resolve({ data: [{ allowed: false, used: 500, limit_value: 500, idempotent: false, usage_event_id: null, reason: "limit_reached" }], error: null });
      },
    } as never;

    const result = await recordUsageEvent(admin, {
      workspaceId: "workspace-1",
      eventType: "chat_turn",
      idempotencyKey: "chat_turn:test:limit",
    });

    expect(result).toEqual({ ok: true, allowed: false, reason: "limit_reached", used: 500, limit: 500 });
  });

});
