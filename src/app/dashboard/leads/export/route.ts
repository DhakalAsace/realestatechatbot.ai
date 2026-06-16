import { NextResponse, type NextRequest } from "next/server";
import { leadsToCsv, type LeadExportRow } from "@/lib/lead-export";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["new", "qualified", "contacted", "converted", "lost", "spam"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ workspace_id: string; role: string }>();

  if (!membership) return NextResponse.json({ error: "Workspace required." }, { status: 403 });
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const channel = request.nextUrl.searchParams.get("channel");
  const assignee = request.nextUrl.searchParams.get("assignee");

  let query = supabase
    .from("leads")
    .select("created_at, name, email, phone, status, temperature, intent, score, location, timeframe, budget_min, budget_max, property_type, property_address, source_label, source, medium, campaign, term, assigned_agent_profile_id, summary")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (status && allowedStatuses.has(status)) query = query.eq("status", status);
  if (channel && uuidPattern.test(channel)) query = query.eq("bot_channel_id", channel);
  if (assignee && uuidPattern.test(assignee)) query = query.eq("assigned_agent_profile_id", assignee);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not export leads." }, { status: 500 });

  const rows = (data ?? []) as LeadExportRow[];
  const audit = await getSupabaseAdminClient().from("audit_events").insert({
    workspace_id: membership.workspace_id,
    actor_user_id: user.id,
    target_user_id: null,
    action: "leads_exported",
    subject_type: "lead",
    subject_id: null,
    metadata: { rowCount: rows.length, status: status ?? null, channel: channel ?? null, assignee: assignee ?? null },
  });

  if (audit.error) return NextResponse.json({ error: "Could not audit lead export." }, { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(leadsToCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realestatechatbot-leads-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
