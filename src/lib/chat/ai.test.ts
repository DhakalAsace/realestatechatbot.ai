import { describe, expect, it } from "vitest";
import { buildSafetyReply, buildUserPrompt, detectSafetyFlags, runAiChatTurn, sanitizePlainReply, type AiGenerate } from "@/lib/chat/ai";
import { runChatTurn } from "@/lib/chat/flow";

const bot = {
  name: "Sarah Patel lead assistant",
  fallback_message: "I can help with buying or selling.",
  ai_enabled: true,
  ai_config: { model: "gpt-5.5" },
};

describe("AI chat turn wrapper", () => {
  it("keeps deterministic state and only replaces the reply on valid AI output", async () => {
    const deterministic = runChatTurn(null, "I want to buy");
    const generate: AiGenerate = async () => ({
      output: {
        reply: "Great, I can help with that. What is your name?",
        action: "ask_next_question",
        safetyFlags: [],
        handoffRecommended: false,
      },
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    });

    const turn = await runAiChatTurn({ bot, previousState: null, visitorMessage: "I want to buy", deterministicResult: deterministic, generate, hasOpenAiKey: true });

    expect(turn.result.reply).toContain("Great");
    expect(turn.result.state).toEqual(deterministic.state);
    expect(turn.result.lead).toEqual(deterministic.lead);
    expect(turn.metadata.mode).toBe("ai");
    expect(turn.metadata.usage).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });
  });

  it("uses deterministic fallback when AI is disabled or unavailable", async () => {
    const deterministic = runChatTurn(null, "I want to sell");
    const disabled = await runAiChatTurn({
      bot: { ...bot, ai_enabled: false },
      previousState: null,
      visitorMessage: "I want to sell",
      deterministicResult: deterministic,
    });
    const missingKey = await runAiChatTurn({ bot, previousState: null, visitorMessage: "I want to sell", deterministicResult: deterministic, hasOpenAiKey: false });

    expect(disabled.result.reply).toBe(deterministic.reply);
    expect(disabled.metadata.mode).toBe("deterministic");
    expect(missingKey.result.reply).toBe(deterministic.reply);
    expect(missingKey.metadata.fallbackReason).toBe("missing_key");
  });

  it("fails closed to deterministic fallback on provider errors", async () => {
    const deterministic = runChatTurn(null, "I want to buy");
    const generate: AiGenerate = async () => {
      throw new Error("provider down");
    };

    const turn = await runAiChatTurn({ bot, previousState: null, visitorMessage: "I want to buy", deterministicResult: deterministic, generate, hasOpenAiKey: true });

    expect(turn.result.reply).toBe(deterministic.reply);
    expect(turn.metadata.mode).toBe("deterministic_fallback");
    expect(turn.metadata.fallbackReason).toBe("ai_error");
  });

  it("freezes state and produces a safe reply for legal, mortgage, property, and fair-housing prompts", async () => {
    const first = runChatTurn(null, "I want to buy");
    const second = runChatTurn(first.state, "Maya Chen");
    const deterministic = runChatTurn(second.state, "Which neighborhoods are safe for families like us?");

    const turn = await runAiChatTurn({
      bot,
      previousState: second.state,
      visitorMessage: "Which neighborhoods are safe for families like us?",
      deterministicResult: deterministic,
      hasOpenAiKey: true,
    });

    expect(turn.metadata.mode).toBe("safety_fallback");
    expect(turn.metadata.safetyFlags).toContain("fair_housing_sensitive");
    expect(turn.result.state).toEqual(second.state);
    expect(turn.result.reply).toContain("protected-class traits");
    expect(turn.result.reply).toContain("best email or phone");

    expect(detectSafetyFlags("What tax strategy should I use?")).toContain("tax_advice");
    expect(detectSafetyFlags("What mortgage rate should I choose?")).toContain("mortgage_or_financial_advice");
    expect(detectSafetyFlags("Can you guarantee the exact value from MLS?")).toContain("property_fact_request");
  });
});

describe("AI prompt helpers", () => {
  it("redacts contact details from the model prompt", () => {
    const deterministic = runChatTurn({ step: "buyer_contact", lead: { intent: "buyer", name: "Maya", email: "maya@example.com", phone: "204-555-0199" } }, "Winnipeg");
    const prompt = buildUserPrompt({ previousState: deterministic.state, deterministicResult: deterministic, visitorMessage: "Winnipeg" });

    expect(prompt).not.toContain("maya@example.com");
    expect(prompt).not.toContain("204-555-0199");
    expect(prompt).not.toContain("sessionId");
    expect(prompt).not.toContain("widgetToken");
  });

  it("keeps replies plain and bounded", () => {
    expect(sanitizePlainReply("**Hello** [link](https://example.com)\nthere", "fallback")).toBe("Hello link there");
    expect(sanitizePlainReply("", "fallback")).toBe("fallback");
    expect(buildSafetyReply(["legal_advice"], "What is your name?")).toContain("cannot give legal");
  });
});
