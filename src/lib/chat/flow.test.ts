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

  it("captures a buyer consultation request after lead capture", () => {
    let state = null;
    for (const message of [
      "I want to buy",
      "Maya Chen",
      "maya@example.com",
      "River Heights",
      "under $700k",
      "this month",
      "house",
      "yes",
    ]) {
      const result = runChatTurn(state, message);
      state = result.state;
    }

    const appointment = runChatTurn(state, "book a consultation tomorrow afternoon");
    expect(appointment.appointmentRequest).toEqual({ type: "buyer_consultation", requestedWindow: "book a consultation tomorrow afternoon" });
    expect(appointment.reply).toContain("buyer consultation request");
  });

  it("asks for a preferred time when appointment request is missing one", () => {
    const first = runChatTurn({ step: "done", lead: { intent: "buyer", name: "Maya", email: "maya@example.com" } }, "book a consultation");
    expect(first.state.step).toBe("appointment_time");
    expect(first.reply).toContain("What day and time");

    const second = runChatTurn(first.state, "Friday at 3pm");
    expect(second.appointmentRequest).toMatchObject({ type: "buyer_consultation", requestedWindow: "Friday at 3pm" });
  });

  it("captures seller valuation time from the seller valuation prompt", () => {
    const result = speak([
      "I want to sell my home",
      "Owen Singh",
      "owen@example.com",
      "St. Vital",
      "in 2 months",
      "yes tomorrow afternoon",
    ]);

    expect(result?.appointmentRequest).toMatchObject({ type: "seller_valuation", requestedWindow: "yes tomorrow afternoon" });
    expect(result?.lead.wantsValuation).toBe(true);
  });

  it("captures showing requests after buyer qualification", () => {
    const result = runChatTurn(
      { step: "done", lead: { intent: "buyer", name: "Maya", email: "maya@example.com", location: "River Heights" } },
      "Can I schedule a showing this weekend?",
    );

    expect(result.appointmentRequest).toMatchObject({ type: "showing" });
  });

  it("does not create appointment requests without contact details", () => {
    const result = runChatTurn({ step: "done", lead: { intent: "buyer", name: "Maya" } }, "book a consultation tomorrow");

    expect(result.appointmentRequest).toBeUndefined();
    expect(result.reply).toContain("email or phone");
  });

  it("does not accept a contact step without email or phone", () => {
    const first = runChatTurn(null, "I want to buy");
    const second = runChatTurn(first.state, "Maya Chen");
    const third = runChatTurn(second.state, "no contact here");

    expect(third.state.step).toBe("buyer_contact");
    expect(third.reply).toContain("email or phone");
  });
});
