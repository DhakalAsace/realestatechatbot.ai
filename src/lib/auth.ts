import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ClaimsCapableAuth = {
  getClaims?: () => Promise<{ data?: { claims?: { sub?: string } }; error?: unknown }>;
};

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const claimsAuth = supabase.auth as typeof supabase.auth & ClaimsCapableAuth;

  if (typeof claimsAuth.getClaims === "function") {
    const { data: claimsData } = await claimsAuth.getClaims();
    if (!claimsData?.claims?.sub) {
      return null;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
