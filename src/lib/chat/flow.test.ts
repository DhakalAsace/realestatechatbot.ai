import { describe, expect, it } from "vitest";
import { parseBudget, runChatTurn } from "@/lib/chat/flow";

function speak(messages: string[]) {
  let state = null;
  let last = null;

  for (const message of messages) {
    last = runChatTurn(state, message);
    state = last.state;
  }

  return last;
}

describe("parseBudget", () => {
  it("handles shorthand max budgets", () => {
    expect(parseBudget("under $500k")).toEqual({ budgetMax: 500000 });
    expect(parseBudget("up to 1.2m")).toEqual({ budgetMax: 1200000 });
  });

  it("handles ranges", () => {
    expect(parseBudget("between 400k and 525k")).toEqual({ budgetMin: 400000, budgetMax: 525000 });
  });
});

describe("runChatTurn", () => {
  it("captures a buyer lead through the deterministic flow", () => {
    const result = speak([
      "I want to buy a house in Winnipeg",
      "Maya Chen",
      "maya@example.com 204-555-0123",
      "River Heights",
      "under $500k",
      "this summer",
      "3 bed house",
      "yes, I am pre-approved",
    ]);

    expect(result?.completed).toBe(true);
    expect(result?.lead.intent).toBe("buyer");
    expect(result?.lead.email).toBe("maya@example.com");
    expect(result?.lead.budgetMax).toBe(500000);
    expect(result?.status).toBe("qualified");
  });

  it("captures a seller lead through the deterministic flow", () => {
    const result = speak([
      "I want to sell my home",
      "Owen Singh",
      "owen@example.com",
      "St. Vital",
      "in 2 months",
      "yes, send valuation",
    ]);

    expect(result?.completed).toBe(true);
    expect(result?.lead.intent).toBe("seller");
    expect(result?.lead.wantsValuation).toBe(true);
    expect(result?.temperature).not.toBe("unknown");
  });

  it("does not accept a contact step without email or phone", () => {
    const first = runChatTurn(null, "I want to buy");
    const second = runChatTurn(first.state, "Maya Chen");
    const third = runChatTurn(second.state, "no contact here");

    expect(third.state.step).toBe("buyer_contact");
    expect(third.reply).toContain("email or phone");
  });
});
