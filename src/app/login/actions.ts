"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  next: z.string().optional(),
  mode: z.enum(["sign-in", "sign-up"]),
});

function safeNext(value: string | undefined) {
  return value?.startsWith("/") ? value : "/dashboard";
}

function fail(reason: string): never {
  redirect("/login?error=" + encodeURIComponent(reason));
}

export async function authenticateWithPassword(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || "/dashboard",
    mode: formData.get("mode"),
  });

  if (!parsed.success) {
    fail("invalid-credentials");
  }

  const supabase = await createServerSupabaseClient();
  const next = safeNext(parsed.data.next);

  if (parsed.data.mode === "sign-up") {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      fail("signup-failed");
    }

    if (!data.session) {
      redirect("/login?notice=confirm-email&email=" + encodeURIComponent(parsed.data.email));
    }

    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    fail("signin-failed");
  }

  redirect(next);
}
