import type { LeadDraft, LeadStatus, LeadTemperature } from "@/lib/chat/types";

function timelineScore(timeframe?: string) {
  const value = timeframe?.toLowerCase() ?? "";

  if (!value) return 0;
  if (/now|asap|immediate|this month|30|1 month|one month|soon/.test(value)) return 20;
  if (/2|3|60|90|spring|summer|fall|winter/.test(value)) return 16;
  if (/4|5|6|six|half/.test(value)) return 10;
  return 5;
}

export function scoreLead(lead: LeadDraft) {
  let score = 0;

  if (lead.intent && lead.intent !== "unknown") score += 15;
  if (lead.name) score += 10;
  if (lead.email || lead.phone) score += 20;
  if (lead.location || lead.propertyAddress) score += 15;
  if (lead.budgetMin || lead.budgetMax || lead.wantsValuation) score += 15;
  if (lead.propertyType) score += 5;
  score += timelineScore(lead.timeframe);
  if (lead.preApproved === true || lead.wantsValuation === true) score += 10;

  return Math.min(100, score);
}

export function classifyLead(score: number): { temperature: LeadTemperature; status: LeadStatus } {
  if (score >= 75) return { temperature: "hot", status: "qualified" };
  if (score >= 45) return { temperature: "warm", status: "qualified" };
  if (score > 0) return { temperature: "cold", status: "new" };
  return { temperature: "unknown", status: "new" };
}

export function summarizeLead(lead: LeadDraft, score: number) {
  const parts = [
    lead.intent && lead.intent !== "unknown" ? `${lead.intent} lead` : "Real estate lead",
    lead.location ? `area: ${lead.location}` : undefined,
    lead.propertyAddress ? `property: ${lead.propertyAddress}` : undefined,
    lead.budgetMax ? `budget up to $${lead.budgetMax.toLocaleString()}` : undefined,
    lead.timeframe ? `timeline: ${lead.timeframe}` : undefined,
    `score: ${score}`,
  ].filter(Boolean);

  return parts.join("; ");
}
