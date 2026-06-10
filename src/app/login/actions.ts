"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

export async function requestMagicLink(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") || "/dashboard",
  });

  if (!parsed.success) {
    redirect("/login?error=invalid-email");
  }

  const supabase = await createServerSupabaseClient();
  const redirectTo = new URL("/auth/confirm", getAppUrl());
  redirectTo.searchParams.set("next", parsed.data.next ?? "/dashboard");

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    redirect("/login?error=auth");
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(parsed.data.email)}`);
}
