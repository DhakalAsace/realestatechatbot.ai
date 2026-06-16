import { describe, expect, it } from "vitest";
import { billingPlans, configuredPaidPlanKeys, getBillingPlan, getStripePriceId, isBillingPlanKey, planKeyForStripePrice } from "@/lib/billing/plans";

describe("billing plans", () => {
  it("falls back to the free plan for unknown values", () => {
    expect(getBillingPlan(undefined).key).toBe("free");
    expect(getBillingPlan("starter").limits.monthly_chat_turns).toBeGreaterThan(billingPlans.free.limits.monthly_chat_turns);
    expect(isBillingPlanKey("enterprise")).toBe(false);
  });

  it("maps only configured Stripe prices to known plan keys", () => {
    const env = {
      STRIPE_STARTER_PRICE_ID: "price_starter_test",
      STRIPE_PRO_PRICE_ID: "price_pro_test",
    };

    expect(getStripePriceId("starter", env)).toBe("price_starter_test");
    expect(planKeyForStripePrice("price_pro_test", env)).toBe("pro");
    expect(planKeyForStripePrice("price_forged", env)).toBeNull();
    expect(configuredPaidPlanKeys(env)).toEqual(["starter", "pro"]);
  });
});
