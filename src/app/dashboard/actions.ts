"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { slugify, withShortSuffix } from "@/lib/slug";

const onboardingSchema = z.object({
  displayName: z.string().min(2).max(120),
  brokerageName: z.string().min(2).max(140),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  city: z.string().min(2).max(80),
  serviceAreas: z.string().min(2).max(300),
  botSlug: z.string().min(2).max(80).optional(),
});

const botSchema = z.object({
  botId: z.string().uuid(),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80),
  status: z.enum(["draft", "active", "paused", "archived"]),
  greeting: z.string().min(10).max(500),
  fallbackMessage: z.string().min(10).max(500),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const leadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "qualified", "contacted", "converted", "lost", "spam"]),
});

export async function completeOnboarding(formData: FormData) {
  await requireUser();
  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    brokerageName: formData.get("brokerageName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    serviceAreas: formData.get("serviceAreas"),
    botSlug: formData.get("botSlug") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/onboarding?error=validation");
  }

  const supabase = await createServerSupabaseClient();
  const workspaceSlug = withShortSuffix(slugify(parsed.data.brokerageName, "workspace"));
  const botSlug = slugify(parsed.data.botSlug || parsed.data.displayName, "agent");
  const serviceAreas = parsed.data.serviceAreas
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);

  const { error } = await supabase.rpc("complete_workspace_onboarding", {
    p_workspace_name: parsed.data.brokerageName,
    p_workspace_slug: workspaceSlug,
    p_display_name: parsed.data.displayName,
    p_brokerage_name: parsed.data.brokerageName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_city: parsed.data.city,
    p_service_areas: serviceAreas,
    p_bot_slug: botSlug,
    p_brand_color: "#163f2f",
  });

  if (error) {
    redirect(onboardingErrorUrl(error, botSlug));
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateBot(formData: FormData) {
  await requireUser();
  const parsed = botSchema.safeParse({
    botId: formData.get("botId"),
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")),
    status: formData.get("status"),
    greeting: formData.get("greeting"),
    fallbackMessage: formData.get("fallbackMessage"),
    brandColor: formData.get("brandColor"),
  });

  if (!parsed.success) redirect("/dashboard?error=bot-validation");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("bots")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      greeting: parsed.data.greeting,
      fallback_message: parsed.data.fallbackMessage,
      theme: { brandColor: parsed.data.brandColor },
    })
    .eq("id", parsed.data.botId);

  if (error) {
    const errorCode = "code" in error ? error.code : undefined;
    const errorMessage = error.message ?? "";
    const reason = errorCode === "23505" || errorMessage.includes("bots_slug_key") ? "duplicate-slug" : "update";

    redirect(`/dashboard/bots/${parsed.data.botId}?error=${reason}`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bots/${parsed.data.botId}`);
  redirect(`/dashboard/bots/${parsed.data.botId}?saved=1`);
}

export async function updateLeadStatus(formData: FormData) {
  await requireUser();
  const parsed = leadStatusSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });

  if (!parsed.success) redirect("/dashboard/leads?error=status");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.leadId);

  if (error) redirect(`/dashboard/leads/${parsed.data.leadId}?error=status`);

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  redirect(`/dashboard/leads/${parsed.data.leadId}?saved=1`);
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function onboardingErrorUrl(error: { message?: string; code?: string }, botSlug: string) {
  const message = error.message ?? "";

  if (message.includes("duplicate_bot_slug") || message.includes("bots_slug_key")) {
    const suggestedSlug = withShortSuffix(botSlug);
    return `/dashboard/onboarding?error=duplicate-slug&botSlug=${encodeURIComponent(botSlug)}&suggestedSlug=${encodeURIComponent(suggestedSlug)}`;
  }

  if (message.includes("already_onboarded")) {
    return "/dashboard";
  }

  if (message.includes("invalid") || message.includes("missing_required_fields")) {
    return "/dashboard/onboarding?error=validation";
  }

  return "/dashboard/onboarding?error=setup";
}
