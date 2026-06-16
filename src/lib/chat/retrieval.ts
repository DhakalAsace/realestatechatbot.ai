import type { LeadDraft } from "@/lib/chat/types";

export type PropertySearchRow = {
  id: string;
  title: string;
  property_type: string | null;
  price: number | null;
  address: string | null;
  city: string | null;
  area: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  highlights: string[] | null;
  image_url: string | null;
  listing_url: string | null;
};

export type KnowledgeSearchRow = {
  id: string;
  title: string;
  kind: "faq" | "note";
  question: string | null;
  body: string;
  tags: string[] | null;
};

export type PropertyCard = {
  id: string;
  title: string;
  priceLabel?: string;
  location?: string;
  details?: string;
  description?: string;
  imageUrl?: string;
  listingUrl?: string;
};

export type KnowledgeSnippet = {
  id: string;
  title: string;
  body: string;
};

export type RetrievalContext = {
  propertyCards: PropertyCard[];
  knowledgeSnippets: KnowledgeSnippet[];
};

const propertyIntentPattern = /\b(property|properties|listing|listings|available|recommend|show me|homes?|houses?|condos?|townhomes?|townhouses?)\b/i;

export function shouldSearchProperties(message: string, lead: LeadDraft) {
  return lead.intent === "buyer" && (propertyIntentPattern.test(message) || Boolean(lead.location || lead.budgetMax || lead.propertyType));
}

export function hasControlledRetrieval(retrieval: RetrievalContext | undefined) {
  return Boolean((retrieval?.propertyCards.length ?? 0) > 0 || (retrieval?.knowledgeSnippets.length ?? 0) > 0);
}

export function buildRetrievalFallbackReply(fallback: string, retrieval: RetrievalContext | undefined, message: string, lead: LeadDraft) {
  const propertyCards = retrieval?.propertyCards ?? [];
  const knowledgeSnippets = retrieval?.knowledgeSnippets ?? [];

  if (propertyCards.length > 0) {
    const label = propertyCards.length === 1 ? "one agent-provided property" : `${propertyCards.length} agent-provided properties`;
    return `I found ${label} that may fit. I included the details here, and the agent can confirm availability, pricing, and next steps. ${fallback}`;
  }

  if (shouldSearchProperties(message, lead) && propertyIntentPattern.test(message)) {
    return `I do not have a matching agent-provided property in this bot yet, so I do not want to invent one. ${fallback}`;
  }

  if (knowledgeSnippets.length > 0) {
    const answer = knowledgeSnippets[0].body.slice(0, 520);
    return `${answer} ${fallback}`;
  }

  return fallback;
}

export function retrievalMetadata(retrieval: RetrievalContext | undefined) {
  const propertyIds = retrieval?.propertyCards.map((card) => card.id) ?? [];
  const knowledgeIds = retrieval?.knowledgeSnippets.map((snippet) => snippet.id) ?? [];

  if (propertyIds.length === 0 && knowledgeIds.length === 0) return undefined;
  return { propertyIds, knowledgeIds };
}

export function selectPropertyCards(properties: PropertySearchRow[], message: string, lead: LeadDraft, limit = 3): PropertyCard[] {
  if (!shouldSearchProperties(message, lead)) return [];

  const terms = tokenize([message, lead.location, lead.propertyType].filter(Boolean).join(" "));

  return properties
    .map((property) => ({ property, score: scoreProperty(property, message, lead, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.property.price ?? Number.MAX_SAFE_INTEGER) - (b.property.price ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit)
    .map(({ property }) => toPropertyCard(property));
}

export function selectKnowledgeSnippets(documents: KnowledgeSearchRow[], message: string, limit = 4): KnowledgeSnippet[] {
  const terms = tokenize(message);
  if (terms.length === 0) return [];

  return documents
    .map((document) => ({ document, score: scoreKnowledge(document, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ document }) => ({ id: document.id, title: document.title, body: document.body.slice(0, 900) }));
}

export function toPropertyCard(property: PropertySearchRow): PropertyCard {
  const details = [
    property.property_type,
    typeof property.bedrooms === "number" ? `${property.bedrooms} bd` : null,
    typeof property.bathrooms === "number" ? `${property.bathrooms} ba` : null,
  ]
    .filter(Boolean)
    .join(" ? ");

  return {
    id: property.id,
    title: property.title,
    priceLabel: formatPrice(property.price),
    location: [property.area, property.city].filter(Boolean).join(", ") || property.address || undefined,
    details: details || undefined,
    description: property.description?.slice(0, 220),
    imageUrl: sanitizePublicUrl(property.image_url),
    listingUrl: sanitizePublicUrl(property.listing_url),
  };
}

function scoreProperty(property: PropertySearchRow, message: string, lead: LeadDraft, terms: string[]) {
  const haystack = [property.title, property.property_type, property.address, property.city, property.area, property.description, ...(property.highlights ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = terms.reduce((total, term) => total + (haystack.includes(term) ? 2 : 0), 0);
  if (terms.length > 0 && score === 0) return 0;

  if (lead.budgetMax && property.price && property.price <= Math.round(lead.budgetMax * 1.05)) score += 4;
  if (lead.budgetMin && property.price && property.price >= Math.round(lead.budgetMin * 0.9)) score += 1;
  if (lead.location && textIncludes(haystack, lead.location)) score += 4;
  if (lead.propertyType && property.property_type && textIncludes(property.property_type, lead.propertyType)) score += 3;
  if (score === 0 && terms.length === 0 && propertyIntentPattern.test(message)) score = 1;

  return score;
}

function scoreKnowledge(document: KnowledgeSearchRow, terms: string[]) {
  const haystack = [document.title, document.question, document.body, ...(document.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(value: string) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((term) => term.length >= 3 && !stopWords.has(term));
}

function textIncludes(value: string, needle: string) {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function formatPrice(value: number | null) {
  if (!value) return undefined;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function sanitizePublicUrl(value: string | null | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const stopWords = new Set(["the", "and", "for", "with", "that", "this", "are", "you", "your", "home", "homes", "house", "houses", "condo", "condos", "townhome", "townhomes", "townhouse", "townhouses", "property", "properties", "listing", "listings", "show"]);
