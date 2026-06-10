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
  const user = await requireUser();
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

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name: parsed.data.brokerageName,
      slug: workspaceSlug,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (workspaceError || !workspace) redirect("/dashboard/onboarding?error=workspace");

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) redirect("/dashboard/onboarding?error=member");

  const { data: profile, error: profileError } = await supabase
    .from("agent_profiles")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      display_name: parsed.data.displayName,
      brokerage_name: parsed.data.brokerageName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      city: parsed.data.city,
      service_areas: serviceAreas,
      brand_color: "#163f2f",
    })
    .select("id")
    .single();

  if (profileError || !profile) redirect("/dashboard/onboarding?error=profile");

  const { data: bot, error: botError } = await supabase
    .from("bots")
    .insert({
      workspace_id: workspace.id,
      agent_profile_id: profile.id,
      name: `${parsed.data.displayName} lead assistant`,
      slug: botSlug,
      status: "active",
      greeting: `Hi, I am ${parsed.data.displayName}'s assistant. Are you looking to buy or sell?`,
      fallback_message: "I can help with buying, selling, valuations, and showing requests. Are you looking to buy or sell?",
      theme: { brandColor: "#163f2f" },
    })
    .select("id")
    .single();

  if (botError || !bot) redirect("/dashboard/onboarding?error=bot");

  const { error: channelError } = await supabase.from("bot_channels").insert({
    workspace_id: workspace.id,
    bot_id: bot.id,
    type: "hosted_link",
    status: "active",
  });

  if (channelError) redirect("/dashboard/onboarding?error=channel");

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

  if (error) redirect(`/dashboard/bots/${parsed.data.botId}?error=update`);

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
