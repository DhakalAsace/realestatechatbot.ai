import type { ChatState, ChatTurnResult, LeadDraft, LeadIntent } from "@/lib/chat/types";
import { classifyLead, scoreLead } from "@/lib/chat/scoring";

const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const phonePattern = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

export function detectIntent(message: string): LeadIntent {
  const text = message.toLowerCase();

  if (/\b(sell|selling|seller|valuation|value my|list my|listing)\b/.test(text)) {
    return "seller";
  }

  if (/\b(buy|buying|buyer|purchase|looking for|home under|condo|house|pre-approved|preapproved)\b/.test(text)) {
    return "buyer";
  }

  return "unknown";
}

export function extractEmail(message: string) {
  return message.match(emailPattern)?.[0].toLowerCase();
}

export function extractPhone(message: string) {
  return message.match(phonePattern)?.[0].replace(/\s+/g, " ");
}

export function parseBudget(message: string) {
  const text = message.toLowerCase().replace(/,/g, "");
  const matches = [...text.matchAll(/\$?([0-9]+(?:\.[0-9]+)?)(\s?m|\s?million|\s?k|\s?thousand)?/g)];
  const values = matches
    .map((match) => {
      const amount = Number(match[1]);
      const unit = match[2]?.trim();
      if (!Number.isFinite(amount)) return null;
      if (unit === "m" || unit === "million") return Math.round(amount * 1_000_000);
      if (unit === "k" || unit === "thousand") return Math.round(amount * 1_000);
      if (amount < 10_000) return Math.round(amount * 1_000);
      return Math.round(amount);
    })
    .filter((value): value is number => Boolean(value));

  if (values.length === 0) return {};
  if (/under|below|up to|max/.test(text)) return { budgetMax: Math.max(...values) };
  if (/over|above|min/.test(text)) return { budgetMin: Math.min(...values) };
  if (values.length >= 2) return { budgetMin: Math.min(...values), budgetMax: Math.max(...values) };
  return { budgetMax: values[0] };
}

function yesNo(message: string) {
  const text = message.toLowerCase();
  if (/\b(yes|yep|yeah|pre-approved|preapproved|approved|sure|please|valuation)\b/.test(text)) return true;
  if (/\b(no|not yet|nope|later|not now)\b/.test(text)) return false;
  return undefined;
}

function captureCommon(lead: LeadDraft, message: string) {
  const email = extractEmail(message);
  const phone = extractPhone(message);

  return {
    ...lead,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

function nextBuyerQuestion(step: string) {
  switch (step) {
    case "buyer_contact":
      return "Thanks. What is the best email or phone number for the agent to follow up?";
    case "buyer_area":
      return "Which city or neighbourhood should we focus on?";
    case "buyer_budget":
      return "What budget range or maximum price should we use?";
    case "buyer_timeline":
      return "What is your ideal timeline for moving?";
    case "buyer_property":
      return "What property type are you looking for? House, condo, townhouse, or something else?";
    case "buyer_preapproved":
      return "Are you already pre-approved for financing?";
    default:
      return "What is your name?";
  }
}

function nextSellerQuestion(step: string) {
  switch (step) {
    case "seller_contact":
      return "Thanks. What is the best email or phone number for the agent to follow up?";
    case "seller_address":
      return "What is the property address or neighbourhood?";
    case "seller_timeline":
      return "When are you hoping to sell?";
    case "seller_valuation":
      return "Would you like the agent to prepare a valuation or pricing opinion?";
    default:
      return "What is your name?";
  }
}

function completeReply(lead: LeadDraft) {
  const contact = lead.email || lead.phone ? "with your contact details" : "with your details";
  return `Perfect. I saved this ${lead.intent === "seller" ? "seller" : "buyer"} request ${contact}. The agent can review the transcript and follow up from the dashboard.`;
}

export function runChatTurn(previousState: ChatState | null | undefined, rawMessage: string): ChatTurnResult {
  const message = cleanText(rawMessage);
  let lead = captureCommon(previousState?.lead ?? {}, message);
  let step = previousState?.step ?? "intent";

  if (step === "intent") {
    const intent = detectIntent(message);
    if (intent === "unknown") {
      const score = scoreLead(lead);
      const classified = classifyLead(score);
      return {
        reply: "I can help with buying or selling. Are you looking to buy a home or sell a property?",
        state: { step: "intent", lead },
        lead,
        completed: false,
        score,
        ...classified,
      };
    }

    lead = { ...lead, intent };
    step = intent === "buyer" ? "buyer_name" : "seller_name";

    const score = scoreLead(lead);
    const classified = classifyLead(score);
    return {
      reply: intent === "buyer" ? nextBuyerQuestion(step) : nextSellerQuestion(step),
      state: { step, lead },
      lead,
      completed: false,
      score,
      ...classified,
    };
  }

  if (step === "buyer_name") {
    lead = { ...lead, name: message };
    step = "buyer_contact";
  } else if (step === "buyer_contact") {
    if (!lead.email && !lead.phone) {
      return replyAgain(lead, step, "Please share an email or phone number so the agent can follow up.");
    }
    step = "buyer_area";
  } else if (step === "buyer_area") {
    lead = { ...lead, location: message };
    step = "buyer_budget";
  } else if (step === "buyer_budget") {
    lead = { ...lead, ...parseBudget(message) };
    step = "buyer_timeline";
  } else if (step === "buyer_timeline") {
    lead = { ...lead, timeframe: message };
    step = "buyer_property";
  } else if (step === "buyer_property") {
    lead = { ...lead, propertyType: message };
    step = "buyer_preapproved";
  } else if (step === "buyer_preapproved") {
    lead = { ...lead, preApproved: yesNo(message) };
    step = "done";
  } else if (step === "seller_name") {
    lead = { ...lead, name: message };
    step = "seller_contact";
  } else if (step === "seller_contact") {
    if (!lead.email && !lead.phone) {
      return replyAgain(lead, step, "Please share an email or phone number so the agent can follow up.");
    }
    step = "seller_address";
  } else if (step === "seller_address") {
    lead = { ...lead, propertyAddress: message, location: message };
    step = "seller_timeline";
  } else if (step === "seller_timeline") {
    lead = { ...lead, timeframe: message };
    step = "seller_valuation";
  } else if (step === "seller_valuation") {
    lead = { ...lead, wantsValuation: yesNo(message) ?? true };
    step = "done";
  }

  const score = scoreLead(lead);
  const classified = classifyLead(score);
  const completed = step === "done";
  const reply = completed
    ? completeReply(lead)
    : lead.intent === "seller"
      ? nextSellerQuestion(step)
      : nextBuyerQuestion(step);

  return {
    reply,
    state: { step, lead },
    lead,
    completed,
    score,
    ...classified,
  };
}

function replyAgain(lead: LeadDraft, step: NonNullable<ChatState["step"]>, reply: string): ChatTurnResult {
  const score = scoreLead(lead);
  const classified = classifyLead(score);

  return {
    reply,
    state: { step, lead },
    lead,
    completed: false,
    score,
    ...classified,
  };
}
