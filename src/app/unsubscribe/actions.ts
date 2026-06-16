"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashFollowUpToken } from "@/lib/follow-ups";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const unsubscribeSchema = z.object({
  token: z.string().min(20).max(200),
});

export async function unsubscribeFollowUp(formData: FormData) {
  const parsed = unsubscribeSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/unsubscribe/invalid?saved=1");

  const admin = getSupabaseAdminClient();
  await admin.rpc("unsubscribe_email_follow_up", { p_token_hash: hashFollowUpToken(parsed.data.token) });
  redirect(`/unsubscribe/${encodeURIComponent(parsed.data.token)}?saved=1`);
}
