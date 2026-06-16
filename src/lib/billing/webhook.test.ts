import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
type TableMap = Record<string, Row[]>;

describe("Stripe webhook billing helpers", () => {
  it("normalizes subscription metadata and configured price IDs", async () => {
    vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter_test");
    const { normalizeStripeSubscription } = await import("@/lib/billing/webhook");

    const normalized = normalizeStripeSubscription(subscriptionEventObject({ planKey: undefined, priceId: "price_starter_test" }));

    expect(normalized?.workspaceId).toBe("workspace-1");
    expect(normalized?.planKey).toBe("starter");
    expect(normalized?.currentPeriodEnd).toBe("2026-07-01T00:00:00.000Z");
    vi.unstubAllEnvs();
  });

  it("processes subscription events once and dedupes event replays", async () => {
    const { handleStripeWebhookEvent } = await import("@/lib/billing/webhook");
    const tables: TableMap = {
      stripe_webhook_events: [],
      billing_customers: [],
      subscriptions: [],
    };
    const admin = fakeAdmin(tables) as unknown as Parameters<typeof handleStripeWebhookEvent>[0];
    const event = stripeEvent("evt_phase8_1", "customer.subscription.updated", subscriptionEventObject({ planKey: "pro", priceId: "price_pro_test" }));

    const first = await handleStripeWebhookEvent(admin, event);
    const second = await handleStripeWebhookEvent(admin, event);

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    expect(tables.billing_customers).toHaveLength(1);
    expect(tables.subscriptions).toHaveLength(1);
    expect(tables.subscriptions[0].plan_key).toBe("pro");
    expect(tables.stripe_webhook_events[0].status).toBe("processed");
  });

  it("reprocesses Stripe events after a previous failed attempt", async () => {
    const { handleStripeWebhookEvent } = await import("@/lib/billing/webhook");
    const tables: TableMap = {
      stripe_webhook_events: [{ stripe_event_id: "evt_retry", status: "failed", created_at: "2026-06-16T00:00:00.000Z" }],
      billing_customers: [],
      subscriptions: [],
    };
    const admin = fakeAdmin(tables) as unknown as Parameters<typeof handleStripeWebhookEvent>[0];

    const result = await handleStripeWebhookEvent(admin, stripeEvent("evt_retry", "customer.subscription.updated", subscriptionEventObject({ planKey: "starter", priceId: "price_starter_test" })));

    expect(result.status).toBe("processed");
    expect(tables.subscriptions).toHaveLength(1);
    expect(tables.stripe_webhook_events[0].status).toBe("processed");
  });

  it("ignores subscription events missing trusted workspace metadata", async () => {
    const { handleStripeWebhookEvent } = await import("@/lib/billing/webhook");
    const tables: TableMap = { stripe_webhook_events: [], billing_customers: [], subscriptions: [] };
    const object = subscriptionEventObject({ planKey: "starter", priceId: "price_starter_test" }) as unknown as { metadata: Record<string, string> };
    object.metadata = { plan_key: "starter" };

    const admin = fakeAdmin(tables) as unknown as Parameters<typeof handleStripeWebhookEvent>[0];
    const result = await handleStripeWebhookEvent(admin, stripeEvent("evt_phase8_ignored", "customer.subscription.created", object as unknown as Stripe.Subscription));

    expect(result.status).toBe("ignored");
    expect(tables.subscriptions).toHaveLength(0);
    expect(tables.stripe_webhook_events[0].status).toBe("ignored");
  });
});

function subscriptionEventObject({ planKey, priceId }: { planKey?: string; priceId: string }): Stripe.Subscription {
  return {
    id: "sub_phase8_test",
    customer: "cus_phase8_test",
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    metadata: { workspace_id: "workspace-1", ...(planKey ? { plan_key: planKey } : {}) },
    items: { data: [{ price: { id: priceId, product: "prod_phase8_test" } }] },
    current_period_start: 1780272000,
    current_period_end: 1782864000,
  } as unknown as Stripe.Subscription;
}

function stripeEvent(id: string, type: string, object: Stripe.Subscription): Stripe.Event {
  return {
    id,
    type,
    api_version: "2026-02-25.clover",
    livemode: false,
    data: { object },
  } as Stripe.Event;
}

function fakeAdmin(tables: TableMap) {
  return {
    from(table: string) {
      return new Query(table, tables);
    },
  };
}

class Query {
  private filters: Array<[string, unknown]> = [];
  private payload: Row | null = null;
  private selected = "*";

  constructor(private table: string, private tables: TableMap) {}

  select(columns = "*") {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  insert(payload: Row) {
    if (this.table === "stripe_webhook_events" && this.tables[this.table].some((row) => row.stripe_event_id === payload.stripe_event_id)) {
      return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
    }
    this.tables[this.table].push({ ...payload });
    return Promise.resolve({ error: null });
  }

  upsert(payload: Row, options?: { onConflict?: string }) {
    const conflict = options?.onConflict?.split(",") ?? [];
    const rows = this.tables[this.table];
    const existing = rows.find((row) => conflict.length > 0 && conflict.every((column) => row[column] === payload[column]));
    if (existing) Object.assign(existing, payload);
    else rows.push({ ...payload, id: `${this.table}-${rows.length + 1}` });
    return Promise.resolve({ error: null });
  }

  update(payload: Row) {
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    const row = this.rows()[0] ?? null;
    if (this.payload && row) Object.assign(row, this.payload);
    return Promise.resolve({ data: this.project(row), error: null });
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      const rows = this.rows();
      if (this.payload) {
        for (const row of rows) Object.assign(row, this.payload);
      }
      return Promise.resolve({ data: rows.map((row) => this.project(row) ?? {}), error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }

  private rows() {
    return this.tables[this.table].filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }

  private project(row: Row | null) {
    if (!row || this.selected === "*") return row;
    const output: Row = {};
    for (const column of this.selected.split(",").map((part) => part.trim())) {
      output[column] = row[column];
    }
    return output;
  }
}
