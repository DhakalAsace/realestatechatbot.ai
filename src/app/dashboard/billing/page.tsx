import { redirect } from "next/navigation";
import { createBillingCheckoutSession, createBillingPortalSession } from "@/app/dashboard/actions";
import { billingPlanKeys, billingPlans, featureLabels, getStripePriceId, type EntitlementFeature } from "@/lib/billing/plans";
import { getStripeRuntimeStatus } from "@/lib/billing/stripe";
import { getBillingContext, type UsageEventRow } from "@/lib/data/dashboard";

type BillingPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const managerRoles = new Set(["owner", "admin"]);
const visibleFeatures: EntitlementFeature[] = [
  "active_bots",
  "channels",
  "team_members",
  "properties",
  "knowledge_documents",
  "monthly_chat_turns",
  "monthly_ai_messages",
  "monthly_follow_up_emails",
];

const errorText: Record<string, string> = {
  permission: "Only owners and admins can manage billing.",
  plan: "Choose a configured paid plan.",
  config: "Stripe test-mode billing is not configured yet.",
  customer: "The Stripe customer record could not be prepared.",
  checkout: "Stripe Checkout could not be started.",
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const [{ workspace, membership, billingSummary, billingCustomer, subscriptions, usageEvents }, params] = await Promise.all([getBillingContext(), searchParams]);

  if (!workspace || !membership || !billingSummary) redirect("/dashboard/onboarding");

  const canManage = managerRoles.has(membership.role);
  const stripeStatus = getStripeRuntimeStatus();
  const error = params.error ? errorText[params.error] ?? "That billing action could not be completed." : null;
  const checkoutNotice = params.checkout === "success" ? "Checkout completed. Stripe will update this page after the webhook is received." : params.checkout === "cancelled" ? "Checkout was cancelled." : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Billing</p>
          <h1 className="mt-2 text-3xl font-semibold">Plan, usage, and limits</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#657064]">
            Track workspace usage and manage test-mode subscription billing. Entitlements are enforced server-side.
          </p>
        </div>
        {!canManage ? <ReadOnlyBadge /> : null}
      </div>

      {!stripeStatus.checkoutReady ? (
        <section className="mb-4 rounded-lg border border-[#efc7b8] bg-[#fff7f3] p-4 text-sm leading-6 text-[#8a3518]">
          Stripe Checkout is disabled in this environment. Add test-mode Stripe keys and price IDs before using subscription actions.
        </section>
      ) : null}
      {error ? <p className="mb-4 rounded-md bg-[#fff1eb] px-4 py-3 text-sm font-medium text-[#8a3518]">{error}</p> : null}
      {checkoutNotice ? <p className="mb-4 rounded-md bg-[#eaf5ec] px-4 py-3 text-sm font-medium text-[#173f2f]">{checkoutNotice}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Current plan" value={billingSummary.plan.name} />
        <Metric label="Status" value={billingSummary.status.replaceAll("_", " ")} />
        <Metric label="Period starts" value={formatDate(billingSummary.periodStart)} />
        <Metric label="Customer" value={billingCustomer ? "Connected" : "Not connected"} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Usage meters</h2>
                <p className="mt-1 text-sm text-[#657064]">Current workspace usage against the active plan.</p>
              </div>
              <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-xs font-semibold capitalize text-[#4c5a49]">{billingSummary.plan.name}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleFeatures.map((feature) => (
                <UsageMeter
                  key={feature}
                  label={featureLabels[feature]}
                  limit={billingSummary.plan.limits[feature]}
                  used={billingSummary.usage[feature]}
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
            <h2 className="text-lg font-semibold">Plans</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {billingPlanKeys.map((planKey) => {
                const plan = billingPlans[planKey];
                const priceId = getStripePriceId(planKey);
                const isCurrent = plan.key === billingSummary.plan.key;
                const canCheckout = canManage && !isCurrent && plan.key !== "free" && stripeStatus.checkoutReady && Boolean(priceId);

                return (
                  <article className="rounded-lg border border-[#d9ded2] bg-[#f8faf6] p-4" key={plan.key}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="mt-1 text-sm text-[#657064]">{plan.monthlyPriceLabel}</p>
                      </div>
                      {isCurrent ? <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#173f2f]">Current</span> : null}
                    </div>
                    <p className="mt-3 min-h-12 text-sm leading-6 text-[#657064]">{plan.description}</p>
                    <ul className="mt-3 space-y-1 text-sm text-[#455247]">
                      <li>{plan.limits.active_bots} active bots</li>
                      <li>{plan.limits.channels} channels</li>
                      <li>{plan.limits.monthly_chat_turns} monthly chat turns</li>
                    </ul>
                    {plan.key === "free" ? (
                      <button className="mt-4 h-11 w-full rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold text-[#657064]" disabled type="button">
                        Included
                      </button>
                    ) : (
                      <form action={createBillingCheckoutSession} className="mt-4">
                        <input name="planKey" type="hidden" value={plan.key} />
                        <button className="h-11 w-full rounded-md bg-[#173f2f] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canCheckout} type="submit">
                          {checkoutButtonLabel({ isCurrent, priceId, checkoutReady: stripeStatus.checkoutReady })}
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
            <h2 className="text-lg font-semibold">Subscription</h2>
            {subscriptions.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-[#657064]">No Stripe subscription has been recorded yet. The workspace is using the Free plan.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {subscriptions.slice(0, 3).map((subscription) => (
                  <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3 text-sm" key={subscription.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold capitalize">{subscription.plan_key}</p>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize">{subscription.status.replaceAll("_", " ")}</span>
                    </div>
                    {subscription.current_period_end ? <p className="mt-2 text-xs text-[#657064]">Renews/ends {formatDate(subscription.current_period_end)}</p> : null}
                    {subscription.cancel_at_period_end ? <p className="mt-1 text-xs text-[#8a3518]">Cancels at period end</p> : null}
                  </div>
                ))}
              </div>
            )}
            <form action={createBillingPortalSession} className="mt-4">
              <button className="h-11 w-full rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage || !stripeStatus.checkoutReady || !billingCustomer} type="submit">
                Open customer portal
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-[#d9ded2] bg-white p-5">
            <h2 className="text-lg font-semibold">Recent usage</h2>
            <div className="mt-4 space-y-3">
              {usageEvents.length === 0 ? (
                <p className="text-sm text-[#657064]">No metered usage has been recorded this period.</p>
              ) : (
                usageEvents.slice(0, 10).map((event) => <UsageEventItem event={event} key={event.id} />)
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function checkoutButtonLabel({ isCurrent, priceId, checkoutReady }: { isCurrent: boolean; priceId: string | null; checkoutReady: boolean }) {
  if (isCurrent) return "Current plan";
  if (!priceId) return "Price missing";
  if (!checkoutReady) return "Checkout disabled";
  return "Start checkout";
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium capitalize">{label}</p>
        <p className="text-[#657064]">{used} / {limit}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white">
        <div className="h-2 rounded-full bg-[#2861a8]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UsageEventItem({ event }: { event: UsageEventRow }) {
  return (
    <div className="rounded-md border border-[#e5e9df] bg-[#f8faf6] p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{event.event_type.replaceAll("_", " ")}</p>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">x{event.quantity}</span>
      </div>
      <p className="mt-1 text-xs text-[#657064]">{formatDate(event.occurred_at)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
      <p className="text-sm text-[#657064]">{label}</p>
      <p className="mt-2 text-2xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function ReadOnlyBadge() {
  return <span className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-semibold text-[#657064]">Read only</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
