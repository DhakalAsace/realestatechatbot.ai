import type { LeadDraft } from "@/lib/chat/types";

export const appointmentTypes = ["buyer_consultation", "seller_valuation", "showing", "general_followup"] as const;

export type AppointmentType = (typeof appointmentTypes)[number];

export type AppointmentRequest = {
  type: AppointmentType;
  requestedWindow: string;
  notes?: string;
};

const showingPattern = /\b(showing|show me|tour|viewing|see the property|see it|open house|walkthrough)\b/i;
const valuationPattern = /\b(valuation|value my|home value|pricing opinion|price opinion|cma|market analysis|sell consultation)\b/i;
const consultationPattern = /\b(consultation|appointment|book|schedule|call|meeting|meet|talk to|speak with)\b/i;
const timePattern = /\b(today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|next week|this week|\d{1,2}(?::\d{2})?\s?(?:am|pm)?|\d{1,2})\b/i;

export function detectAppointmentType(message: string, lead?: LeadDraft): AppointmentType | null {
  const text = message.trim();

  if (!text) return null;
  if (showingPattern.test(text)) return "showing";
  if (valuationPattern.test(text)) return "seller_valuation";

  if (consultationPattern.test(text)) {
    return lead?.intent === "seller" ? "seller_valuation" : "buyer_consultation";
  }

  return null;
}

export function hasRequestedWindow(message: string) {
  return timePattern.test(message);
}

export function appointmentTypeLabel(type: AppointmentType) {
  switch (type) {
    case "buyer_consultation":
      return "buyer consultation";
    case "seller_valuation":
      return "seller valuation";
    case "showing":
      return "showing";
    case "general_followup":
      return "general follow-up";
  }
}

export function normalizeCalendarUrl(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
