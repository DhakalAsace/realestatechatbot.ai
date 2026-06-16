import { NextResponse } from "next/server";
import { constructStripeWebhookEvent } from "@/lib/billing/stripe";
import { handleStripeWebhookEvent } from "@/lib/billing/webhook";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });

  const body = await request.text();
  let event;

  try {
    event = constructStripeWebhookEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Billing storage is not configured." }, { status: 503 });
  }

  const result = await handleStripeWebhookEvent(admin, event);
  if (result.status === "failed") {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true, status: result.status });
}
