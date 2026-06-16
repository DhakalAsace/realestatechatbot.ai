import { describe, expect, it } from "vitest";
import { selectKnowledgeSnippets, selectPropertyCards, shouldSearchProperties, type KnowledgeSearchRow, type PropertySearchRow } from "@/lib/chat/retrieval";

const properties: PropertySearchRow[] = [
  {
    id: "river-house",
    title: "River Heights family house",
    property_type: "house",
    price: 780000,
    address: "123 Oak Street",
    city: "Winnipeg",
    area: "River Heights",
    bedrooms: 4,
    bathrooms: 2.5,
    description: "Updated house near parks.",
    highlights: ["garage", "finished basement"],
    image_url: null,
    listing_url: "https://example.com/river-house",
  },
  {
    id: "downtown-condo",
    title: "Downtown condo",
    property_type: "condo",
    price: 420000,
    address: "22 Main Street",
    city: "Winnipeg",
    area: "Downtown",
    bedrooms: 2,
    bathrooms: 2,
    description: "Condo close to restaurants.",
    highlights: [],
    image_url: null,
    listing_url: null,
  },
];

const documents: KnowledgeSearchRow[] = [
  {
    id: "service-areas",
    title: "Service areas",
    kind: "faq",
    question: "Which areas do you serve?",
    body: "Sarah focuses on Winnipeg, River Heights, and St. Vital.",
    tags: ["areas", "service"],
  },
];

describe("property retrieval", () => {
  it("searches only for buyer/property contexts", () => {
    expect(shouldSearchProperties("Do you have listings?", { intent: "seller" })).toBe(false);
    expect(shouldSearchProperties("Do you have listings?", { intent: "buyer" })).toBe(true);
  });

  it("returns controlled property cards instead of invented facts", () => {
    const cards = selectPropertyCards(properties, "Show me River Heights houses", { intent: "buyer", location: "River Heights", budgetMax: 900000, propertyType: "house" });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "river-house", title: "River Heights family house", priceLabel: "$780,000" });
  });

  it("returns no cards without matching controlled data", () => {
    const cards = selectPropertyCards([], "Show me homes in River Heights", { intent: "buyer", location: "River Heights" });
    expect(cards).toEqual([]);
  });
});

describe("knowledge retrieval", () => {
  it("selects matching snippets from controlled docs", () => {
    expect(selectKnowledgeSnippets(documents, "Which areas do you serve?")).toEqual([
      { id: "service-areas", title: "Service areas", body: "Sarah focuses on Winnipeg, River Heights, and St. Vital." },
    ]);
  });
});
