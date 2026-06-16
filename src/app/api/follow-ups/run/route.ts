import { NextResponse } from "next/server";
import type { AppointmentType } from "@/lib/appointments";
import type { LeadDraft } from "@/lib/chat/types";
import {
  createUnsubscribeToken,
  hashFollowUpToken,
  matchesFollowUpTrigger,
  normalizeEmail,
  renderFollowUpTemplate,
  sendFollowUpEmail,
  type FollowUpTriggerType,
} from "@/lib/follow-ups";
import { getAppUrl } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

type LeadRecord = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  bot_id: string;
  agent_profile_id: string | null;
  assigned_agent_profile_id: string | null;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  intent: "buyer" | "seller" | "unknown";
  location: string | null;
  timeframe: string | null;
  property_address: string | null;
  wants_valuation: boolean | null;
  created_at: string;
};

type AppointmentRecord = {
  lead_id: string;
  request_type: AppointmentType;
};

type SequenceRecord = {
  id: string;
  workspace_id: string;
  bot_id: string;
  trigger_type: FollowUpTriggerType;
  status: string;
};

type MessageRecord = {
  id: string;
  workspace_id: string;
  sequence_id: string;
  step_index: number;
  delay_minutes: number;
  status: string;
  subject_template: string;
  body_template: string;
};

type StateRecord = {
  id: string;
  workspace_id: string;
  lead_id: string;
  sequence_id: string;
  current_message_id: string | null;
  status: string;
  attempt_count: number;
  max_attempts: number;
  errors: unknown;
};

type EmailPreferenceRecord = {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  email: string;
  status: "pending" | "opted_in" | "unsubscribed";
  unsubscribe_token_hash: string | null;
};

type ProcessStats = {
  seeded: number;
  processed: number;
  sent: number;
  skipped: number;
  pendingConsent: number;
  failed: number;
  unsubscribed: number;
  errors: string[];
};

export async function GET(request: Request) {
  return runFollowUps(request);
}

export async function POST(request: Request) {
  return runFollowUps(request);
}

async function runFollowUps(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: "Follow-up scheduler is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin: AdminClient;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Follow-up scheduler is not configured." }, { status: 503 });
  }

  const seeded = await seedLeadFollowUps(admin);
  const processed = await processDueFollowUps(admin);

  return NextResponse.json({
    ok: true,
    ...mergeStats(seeded, processed),
  });
}

async function seedLeadFollowUps(admin: AdminClient): Promise<ProcessStats> {
  const stats = emptyStats();
  const { data: leads, error: leadError } = await admin
    .from("leads")
    .select("id, workspace_id, conversation_id, bot_id, agent_profile_id, assigned_agent_profile_id, status, name, email, phone, intent, location, timeframe, property_address, wants_valuation, created_at")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (leadError) return withError(stats, `leads:${leadError.message}`);

  const usableLeads = ((leads ?? []) as LeadRecord[]).filter((lead) => normalizeEmail(lead.email) && lead.status !== "lost" && lead.status !== "spam");
  if (usableLeads.length === 0) return stats;

  const leadIds = usableLeads.map((lead) => lead.id);
  const botIds = [...new Set(usableLeads.map((lead) => lead.bot_id))];

  const [{ data: appointments, error: appointmentError }, { data: sequences, error: sequenceError }] = await Promise.all([
    admin.from("appointments").select("lead_id, request_type").in("lead_id", leadIds),
    admin.from("follow_up_sequences").select("id, workspace_id, bot_id, trigger_type, status").eq("status", "active").in("bot_id", botIds),
  ]);

  if (appointmentError) return withError(stats, `appointments:${appointmentError.message}`);
  if (sequenceError) return withError(stats, `sequences:${sequenceError.message}`);

  const activeSequences = (sequences ?? []) as SequenceRecord[];
  if (activeSequences.length === 0) return stats;

  const sequenceIds = activeSequences.map((sequence) => sequence.id);
  const { data: messages, error: messageError } = await admin
    .from("follow_up_messages")
    .select("id, workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template")
    .eq("status", "active")
    .in("sequence_id", sequenceIds)
    .order("step_index", { ascending: true });

  if (messageError) return withError(stats, `messages:${messageError.message}`);

  const appointmentsByLead = new Map<string, AppointmentType[]>();
  for (const appointment of (appointments ?? []) as AppointmentRecord[]) {
    appointmentsByLead.set(appointment.lead_id, [...(appointmentsByLead.get(appointment.lead_id) ?? []), appointment.request_type]);
  }

  const firstMessageBySequence = new Map<string, MessageRecord>();
  for (const message of (messages ?? []) as MessageRecord[]) {
    if (!firstMessageBySequence.has(message.sequence_id)) firstMessageBySequence.set(message.sequence_id, message);
  }

  const preferenceRows: Array<{ workspace_id: string; lead_id: string; email: string; status: "pending" }> = [];
  for (const lead of usableLeads) {
    const email = normalizeEmail(lead.email);
    if (email) preferenceRows.push({ workspace_id: lead.workspace_id, lead_id: lead.id, email, status: "pending" });
  }

  if (preferenceRows.length > 0) {
    const { error } = await admin.from("lead_email_preferences").upsert(preferenceRows, { onConflict: "workspace_id,email", ignoreDuplicates: true });
    if (error) stats.errors.push(`preferences:${error.message}`);
  }

  const stateRows = [];
  for (const lead of usableLeads) {
    const appointmentTypes = appointmentsByLead.get(lead.id) ?? [];
    const leadDraft = toLeadDraft(lead);
    const matchingSequences = activeSequences.filter((sequence) => sequence.bot_id === lead.bot_id && sequence.workspace_id === lead.workspace_id);

    for (const sequence of matchingSequences) {
      if (!matchesFollowUpTrigger({ triggerType: sequence.trigger_type, lead: leadDraft, appointmentTypes })) continue;

      const message = firstMessageBySequence.get(sequence.id);
      if (!message) continue;

      stateRows.push({
        workspace_id: lead.workspace_id,
        lead_id: lead.id,
        sequence_id: sequence.id,
        current_message_id: message.id,
        status: "scheduled",
        next_send_at: dueAt(lead.created_at, message.delay_minutes),
        idempotency_key: `followup:${lead.id}:${sequence.id}:1`,
        metadata: { triggerType: sequence.trigger_type },
      });
    }
  }

  if (stateRows.length === 0) return stats;

  const { data: inserted, error } = await admin
    .from("lead_follow_up_state")
    .upsert(stateRows, { onConflict: "workspace_id,lead_id,sequence_id", ignoreDuplicates: true })
    .select("id");

  if (error) return withError(stats, `states:${error.message}`);

  stats.seeded = inserted?.length ?? 0;
  return stats;
}

async function processDueFollowUps(admin: AdminClient): Promise<ProcessStats> {
  const stats = emptyStats();
  const { data: states, error } = await admin
    .from("lead_follow_up_state")
    .select("id, workspace_id, lead_id, sequence_id, current_message_id, status, attempt_count, max_attempts, errors")
    .in("status", ["scheduled", "failed"])
    .lte("next_send_at", new Date().toISOString())
    .order("next_send_at", { ascending: true })
    .limit(25);

  if (error) return withError(stats, `due:${error.message}`);

  for (const state of (states ?? []) as StateRecord[]) {
    const result = await processState(admin, state);
    stats.processed += result.processed;
    stats.sent += result.sent;
    stats.skipped += result.skipped;
    stats.pendingConsent += result.pendingConsent;
    stats.failed += result.failed;
    stats.unsubscribed += result.unsubscribed;
    stats.errors.push(...result.errors);
  }

  return stats;
}

async function processState(admin: AdminClient, state: StateRecord): Promise<ProcessStats> {
  const stats = emptyStats();
  const { data: claimed, error: claimError } = await admin
    .from("lead_follow_up_state")
    .update({ status: "processing" })
    .eq("id", state.id)
    .eq("workspace_id", state.workspace_id)
    .in("status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();

  if (claimError) return withError(stats, `claim:${claimError.message}`);
  if (!claimed) return stats;

  stats.processed = 1;
  const [leadResult, sequenceResult, messageResult] = await Promise.all([
    admin.from("leads").select("id, workspace_id, conversation_id, bot_id, agent_profile_id, assigned_agent_profile_id, status, name, email, phone, intent, location, timeframe, property_address, wants_valuation, created_at").eq("id", state.lead_id).eq("workspace_id", state.workspace_id).maybeSingle(),
    admin.from("follow_up_sequences").select("id, workspace_id, bot_id, trigger_type, status").eq("id", state.sequence_id).eq("workspace_id", state.workspace_id).maybeSingle(),
    state.current_message_id
      ? admin.from("follow_up_messages").select("id, workspace_id, sequence_id, step_index, delay_minutes, status, subject_template, body_template").eq("id", state.current_message_id).eq("workspace_id", state.workspace_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (leadResult.error || sequenceResult.error || messageResult.error) {
    return finishWithFailure(admin, state, stats, "load_failed", leadResult.error?.message ?? sequenceResult.error?.message ?? messageResult.error?.message ?? "load_failed");
  }

  const lead = leadResult.data as LeadRecord | null;
  const sequence = sequenceResult.data as SequenceRecord | null;
  const message = messageResult.data as MessageRecord | null;

  if (!lead || !sequence || !message || sequence.status !== "active" || message.status !== "active" || lead.status === "lost" || lead.status === "spam") {
    return finishWithSkipped(admin, state, stats, "inactive_or_missing_record");
  }

  const email = normalizeEmail(lead.email);
  if (!email) return finishWithSkipped(admin, state, stats, "missing_lead_email");

  const { data: preferenceData, error: preferenceError } = await admin
    .from("lead_email_preferences")
    .select("id, workspace_id, lead_id, email, status, unsubscribe_token_hash")
    .eq("workspace_id", state.workspace_id)
    .eq("email", email)
    .maybeSingle();

  if (preferenceError) return finishWithFailure(admin, state, stats, "preference_load_failed", preferenceError.message);

  const preference = preferenceData as EmailPreferenceRecord | null;
  if (!preference || preference.status === "pending") {
    const event = await recordNotification(admin, state, lead, message, {
      status: "skipped",
      reason: "missing_explicit_email_consent",
      recipientEmail: email,
      payload: { sequenceId: sequence.id, triggerType: sequence.trigger_type },
    });
    if (event.error) return finishWithTerminalFailure(admin, state, stats, "notification_event_failed", event.error);

    await updateState(admin, state, { status: "pending_consent", attempt_count: state.attempt_count + 1, next_send_at: null, last_notification_event_id: event.id, errors: appendError(state.errors, "missing_explicit_email_consent") });
    stats.pendingConsent = 1;
    return stats;
  }

  if (preference.status === "unsubscribed") {
    const event = await recordNotification(admin, state, lead, message, {
      status: "skipped",
      reason: "recipient_unsubscribed",
      recipientEmail: email,
      payload: { sequenceId: sequence.id, triggerType: sequence.trigger_type },
    });
    if (event.error) return finishWithTerminalFailure(admin, state, stats, "notification_event_failed", event.error);

    await updateState(admin, state, { status: "unsubscribed", attempt_count: state.attempt_count + 1, next_send_at: null, last_notification_event_id: event.id, errors: appendError(state.errors, "recipient_unsubscribed") });
    stats.unsubscribed = 1;
    return stats;
  }

  const token = createUnsubscribeToken();
  const unsubscribeUrl = `${getAppUrl()}/unsubscribe/${encodeURIComponent(token)}`;
  const { data: tokenWrite, error: tokenError } = await admin
    .from("lead_email_preferences")
    .update({ lead_id: lead.id, unsubscribe_token_hash: hashFollowUpToken(token) })
    .eq("id", preference.id)
    .eq("workspace_id", state.workspace_id)
    .select("id")
    .maybeSingle();

  if (tokenError || !tokenWrite) {
    const event = await recordNotification(admin, state, lead, message, {
      status: "failed",
      reason: "unsubscribe_token_persist_failed",
      recipientEmail: email,
      payload: { sequenceId: sequence.id, triggerType: sequence.trigger_type },
    });
    await updateState(admin, state, {
      status: "failed",
      attempt_count: state.attempt_count + 1,
      next_send_at: retryAt(state.attempt_count + 1),
      last_notification_event_id: event.id,
      errors: appendError(state.errors, event.error ? `notification_event_failed:${event.error}` : "unsubscribe_token_persist_failed"),
    });
    stats.failed = 1;
    return stats;
  }

  const agentName = await loadAgentName(admin, lead);
  const templateValues = {
    lead_name: lead.name ?? "there",
    agent_name: agentName,
    area: lead.location ?? lead.property_address ?? "your area",
    timeline: lead.timeframe ?? "your timeline",
    unsubscribe_url: unsubscribeUrl,
  };
  const subject = renderFollowUpTemplate(message.subject_template, templateValues).slice(0, 200);
  const body = renderFollowUpTemplate(message.body_template, templateValues).slice(0, 4000);
  const delivery = await sendFollowUpEmail({ recipientEmail: email, subject, body, unsubscribeUrl });
  const event = await recordNotification(admin, state, lead, message, {
    status: delivery.status,
    providerId: delivery.status === "sent" ? delivery.providerId : undefined,
    reason: delivery.status === "sent" ? undefined : delivery.reason,
    recipientEmail: email,
    payload: { sequenceId: sequence.id, triggerType: sequence.trigger_type, subject },
  });

  if (event.error) {
    return finishWithTerminalFailure(admin, state, stats, "notification_event_failed", event.error);
  }

  if (delivery.status === "sent") {
    await updateState(admin, state, { status: "completed", attempt_count: state.attempt_count + 1, next_send_at: null, last_notification_event_id: event.id });
    stats.sent = 1;
    return stats;
  }

  if (delivery.status === "skipped") {
    await updateState(admin, state, { status: "skipped", attempt_count: state.attempt_count + 1, next_send_at: null, last_notification_event_id: event.id, errors: appendError(state.errors, delivery.reason) });
    stats.skipped = 1;
    return stats;
  }

  const nextAttempt = state.attempt_count + 1;
  const canRetry = nextAttempt < state.max_attempts;
  await updateState(admin, state, {
    status: "failed",
    attempt_count: nextAttempt,
    next_send_at: canRetry ? retryAt(nextAttempt) : null,
    last_notification_event_id: event.id,
    errors: appendError(state.errors, delivery.reason),
  });
  stats.failed = 1;
  return stats;
}

async function recordNotification(
  admin: AdminClient,
  state: StateRecord,
  lead: LeadRecord,
  message: MessageRecord,
  result: { status: "sent" | "failed" | "skipped"; providerId?: string; reason?: string; recipientEmail: string; payload: Record<string, unknown> },
): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await admin
    .from("notification_events")
    .insert({
      workspace_id: state.workspace_id,
      appointment_id: null,
      lead_id: lead.id,
      follow_up_state_id: state.id,
      follow_up_message_id: message.id,
      event_type: "follow_up_email",
      channel: "email",
      recipient_type: "lead",
      recipient_email: result.recipientEmail,
      status: result.status,
      provider: "resend",
      provider_message_id: result.providerId ?? null,
      idempotency_key: `followup:${state.id}:${message.id}:${state.attempt_count + 1}`,
      attempt_count: state.attempt_count + 1,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      failed_at: result.status === "failed" ? new Date().toISOString() : null,
      error_code: result.reason ?? null,
      error_message: result.reason ?? null,
      payload: result.payload,
    })
    .select("id")
    .maybeSingle();

  if (error) return { id: null, error: error.message };
  return { id: (data as { id: string } | null)?.id ?? null };
}

async function updateState(admin: AdminClient, state: StateRecord, updates: Record<string, unknown>) {
  await admin.from("lead_follow_up_state").update(updates).eq("id", state.id).eq("workspace_id", state.workspace_id);
}

async function finishWithSkipped(admin: AdminClient, state: StateRecord, stats: ProcessStats, reason: string) {
  await updateState(admin, state, { status: "skipped", next_send_at: null, errors: appendError(state.errors, reason) });
  stats.skipped = 1;
  return stats;
}

async function finishWithFailure(admin: AdminClient, state: StateRecord, stats: ProcessStats, reason: string, message: string) {
  const nextAttempt = state.attempt_count + 1;
  await updateState(admin, state, { status: "failed", attempt_count: nextAttempt, next_send_at: retryAt(nextAttempt), errors: appendError(state.errors, `${reason}:${message.slice(0, 120)}`) });
  stats.failed = 1;
  return stats;
}

async function finishWithTerminalFailure(admin: AdminClient, state: StateRecord, stats: ProcessStats, reason: string, message: string) {
  await updateState(admin, state, { status: "failed", attempt_count: state.attempt_count + 1, next_send_at: null, errors: appendError(state.errors, `${reason}:${message.slice(0, 120)}`) });
  stats.failed = 1;
  return stats;
}

async function loadAgentName(admin: AdminClient, lead: LeadRecord) {
  const profileId = lead.assigned_agent_profile_id ?? lead.agent_profile_id;
  if (!profileId) return "the agent";

  const { data } = await admin
    .from("agent_profiles")
    .select("display_name")
    .eq("id", profileId)
    .eq("workspace_id", lead.workspace_id)
    .maybeSingle();

  return (data as { display_name?: string } | null)?.display_name ?? "the agent";
}

function toLeadDraft(lead: LeadRecord): LeadDraft {
  return {
    name: lead.name ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    intent: lead.intent,
    location: lead.location ?? undefined,
    timeframe: lead.timeframe ?? undefined,
    propertyAddress: lead.property_address ?? undefined,
    wantsValuation: lead.wants_valuation ?? undefined,
  };
}

function dueAt(createdAt: string, delayMinutes: number) {
  return new Date(new Date(createdAt).getTime() + delayMinutes * 60_000).toISOString();
}

function retryAt(attempt: number) {
  const delayMinutes = Math.min(60 * 2 ** Math.max(0, attempt - 1), 1440);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function appendError(existing: unknown, code: string) {
  const items = Array.isArray(existing) ? existing.slice(-9) : [];
  return [...items, { code, at: new Date().toISOString() }];
}

function emptyStats(): ProcessStats {
  return { seeded: 0, processed: 0, sent: 0, skipped: 0, pendingConsent: 0, failed: 0, unsubscribed: 0, errors: [] };
}

function withError(stats: ProcessStats, message: string) {
  stats.errors.push(message);
  return stats;
}

function mergeStats(...statsList: ProcessStats[]) {
  return statsList.reduce(
    (merged, stats) => ({
      seeded: merged.seeded + stats.seeded,
      processed: merged.processed + stats.processed,
      sent: merged.sent + stats.sent,
      skipped: merged.skipped + stats.skipped,
      pendingConsent: merged.pendingConsent + stats.pendingConsent,
      failed: merged.failed + stats.failed,
      unsubscribed: merged.unsubscribed + stats.unsubscribed,
      errors: [...merged.errors, ...stats.errors],
    }),
    emptyStats(),
  );
}
