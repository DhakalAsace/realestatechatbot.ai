export type LeadIntent = "buyer" | "seller" | "unknown";
export type LeadTemperature = "hot" | "warm" | "cold" | "unknown";
export type LeadStatus = "new" | "qualified";

export type LeadDraft = {
  name?: string;
  email?: string;
  phone?: string;
  intent?: LeadIntent;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  timeframe?: string;
  propertyType?: string;
  preApproved?: boolean;
  propertyAddress?: string;
  wantsValuation?: boolean;
};

export type ChatStep =
  | "intent"
  | "buyer_name"
  | "buyer_contact"
  | "buyer_area"
  | "buyer_budget"
  | "buyer_timeline"
  | "buyer_property"
  | "buyer_preapproved"
  | "seller_name"
  | "seller_contact"
  | "seller_address"
  | "seller_timeline"
  | "seller_valuation"
  | "done";

export type ChatState = {
  step?: ChatStep;
  lead?: LeadDraft;
};

export type ChatTurnResult = {
  reply: string;
  state: ChatState;
  lead: LeadDraft;
  completed: boolean;
  score: number;
  temperature: LeadTemperature;
  status: LeadStatus;
};
