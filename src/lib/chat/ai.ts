import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { questionForStep } from "@/lib/chat/flow";
import { classifyLead, scoreLead } from "@/lib/chat/scoring";
import { buildRetrievalFallbackReply, hasControlledRetrieval, retrievalMetadata, type RetrievalContext } from "@/lib/chat/retrieval";
import type { ChatState, ChatTurnResult, LeadDraft } from "@/lib/chat/types";

const defaultModel = "gpt-5.5";
const maxReplyChars = 700;
const defaultTimeoutMs = 8_000;

export const aiSafetyFlagValues = [
  "property_fact_request",
  "legal_advice",
  "tax_advice",
  "mortgage_or_financial_advice",
  "fair_housing_sensitive",
  "off_topic",
] as const;

export type AiSafetyFlag = (typeof aiSafetyFlagValues)[number];

const aiSafetyFlagSchema = z.enum(aiSafetyFlagValues);

export const aiChatOutputSchema = z.object({
  reply: z.string().trim().min(1).max(maxReplyChars),
  action: z.enum(["ask_next_question", "safe_redirect", "complete_capture"]),
  safetyFlags: z.array(aiSafetyFlagSchema).max(6).default([]),
  handoffRecommended: z.boolean().default(false),
});

export type AiChatOutput = z.infer<typeof aiChatOutputSchema>;

export type AiTurnMetadata = {
  phase: 3;
  enabled: boolean;
  mode: "ai" | "deterministic" | "deterministic_fallback" | "safety_fallback";
  provider?: "openai";
  model?: string;
  latencyMs?: number;
  usage?: unknown;
  validation: "passed" | "fallback";
  action?: AiChatOutput["action"];
  handoffRecommended?: boolean;
  fallbackReason?: "disabled" | "disabled_by_env" | "missing_key" | "ai_error" | "invalid_output" | "safety_flag";
  safetyFlags: AiSafetyFlag[];
  retrieval?: { propertyIds: string[]; knowledgeIds: string[] };
};

export type AiChatBotConfig = {
  name: string;
  fallback_message?: string | null;
  ai_enabled?: boolean | null;
  ai_config?: Record<string, unknown> | null;
};

export type AiGenerateInput = {
  modelId: string;
  system: string;
  prompt: string;
  timeoutMs: number;
};

export type AiGenerateResult = {
  output: AiChatOutput;
  usage?: unknown;
};

export type AiGenerate = (input: AiGenerateInput) => Promise<AiGenerateResult>;

export type RunAiChatTurnOptions = {
  bot: AiChatBotConfig;
  previousState: ChatState | null | undefined;
  visitorMessage: string;
  deterministicResult: ChatTurnResult;
  generate?: AiGenerate;
  now?: () => number;
  hasOpenAiKey?: boolean;
  disableModel?: boolean;
  timeoutMs?: number;
  retrieval?: RetrievalContext;
};

export type AiChatTurn = {
  result: ChatTurnResult;
  metadata: AiTurnMetadata;
};

export async function runAiChatTurn({
  bot,
  previousState,
  visitorMessage,
  deterministicResult,
  generate = generateAiText,
  now = Date.now,
  hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY),
  disableModel = process.env.AI_CHAT_DISABLE_MODEL === "1",
  timeoutMs = defaultTimeoutMs,
  retrieval,
}: RunAiChatTurnOptions): Promise<AiChatTurn> {
  const modelId = resolveModelId(bot.ai_config);
  const detectedFlags = detectSafetyFlags(visitorMessage);
  const blockingFlags = detectedFlags.filter((flag) => flag !== "property_fact_request" || !hasControlledRetrieval(retrieval));
  const groundedResult = {
    ...deterministicResult,
    reply: buildRetrievalFallbackReply(deterministicResult.reply, retrieval, visitorMessage, deterministicResult.lead),
  };

  if (!bot.ai_enabled) {
    return deterministicTurn(groundedResult, {
      enabled: false,
      model: modelId,
      fallbackReason: "disabled",
      safetyFlags: detectedFlags,
      mode: "deterministic",
      retrieval: retrievalMetadata(retrieval),
    });
  }

  if (blockingFlags.length > 0) {
    const safeResult = freezeLeadStateForSafety(previousState, blockingFlags);
    return deterministicTurn(safeResult, {
      enabled: true,
      model: modelId,
      fallbackReason: "safety_flag",
      safetyFlags: blockingFlags,
      mode: "safety_fallback",
      retrieval: retrievalMetadata(retrieval),
    });
  }

  if (disableModel) {
    return deterministicTurn(groundedResult, {
      enabled: true,
      model: modelId,
      fallbackReason: "disabled_by_env",
      safetyFlags: detectedFlags,
      mode: "deterministic_fallback",
      retrieval: retrievalMetadata(retrieval),
    });
  }

  if (!hasOpenAiKey) {
    return deterministicTurn(groundedResult, {
      enabled: true,
      model: modelId,
      fallbackReason: "missing_key",
      safetyFlags: detectedFlags,
      mode: "deterministic_fallback",
      retrieval: retrievalMetadata(retrieval),
    });
  }

  const startedAt = now();

  try {
    const generated = await generate({
      modelId,
      system: buildSystemPrompt(bot),
      prompt: buildUserPrompt({ previousState, deterministicResult: groundedResult, visitorMessage, retrieval }),
      timeoutMs,
    });
    const output = aiChatOutputSchema.safeParse(generated.output);

    if (!output.success) {
      return deterministicTurn(groundedResult, {
        enabled: true,
        model: modelId,
        fallbackReason: "invalid_output",
        safetyFlags: detectedFlags,
        mode: "deterministic_fallback",
        latencyMs: Math.max(0, now() - startedAt),
        retrieval: retrievalMetadata(retrieval),
      });
    }

    const safetyFlags = dedupeFlags(output.data.safetyFlags);
    const reply = sanitizePlainReply(
      safetyFlags.length > 0 ? buildSafetyReply(safetyFlags, deterministicResult.reply) : output.data.reply,
      deterministicResult.reply,
    );

    return {
      result: { ...deterministicResult, reply },
      metadata: {
        phase: 3,
        enabled: true,
        mode: "ai",
        provider: "openai",
        model: modelId,
        latencyMs: Math.max(0, now() - startedAt),
        usage: toJsonSafe(generated.usage),
        validation: "passed",
        action: output.data.action,
        handoffRecommended: output.data.handoffRecommended,
        safetyFlags: dedupeFlags([...detectedFlags, ...safetyFlags]),
        retrieval: retrievalMetadata(retrieval),
      },
    };
  } catch (error) {
    console.error("ai_chat_turn_failed", error instanceof Error ? error.message : "unknown");
    return deterministicTurn(groundedResult, {
      enabled: true,
      model: modelId,
      fallbackReason: "ai_error",
      safetyFlags: detectedFlags,
      mode: "deterministic_fallback",
      latencyMs: Math.max(0, now() - startedAt),
      retrieval: retrievalMetadata(retrieval),
    });
  }
}

export function detectSafetyFlags(message: string): AiSafetyFlag[] {
  const text = message.toLowerCase();
  const flags: AiSafetyFlag[] = [];

  if (/\b(lawyer|legal|contract clause|lawsuit|sue|liability|disclosure law|legal advice)\b/.test(text)) flags.push("legal_advice");
  if (/\b(tax|capital gains|write[- ]?off|deduction|1031|income tax|tax advice)\b/.test(text)) flags.push("tax_advice");
  if (/\b(mortgage rate|interest rate|fixed or variable|loan advice|refinance|can i afford|financial advice|investment return|guaranteed return)\b/.test(text)) {
    flags.push("mortgage_or_financial_advice");
  }
  if (/\b(safe|family friendly|families|kids like us|race|ethnic|religion|church|mosque|temple|crime rate|demographic|protected class)\b/.test(text)) {
    flags.push("fair_housing_sensitive");
  }
  if (/\b(guarantee.*value|exact value|mls|listing details|is .* available|actual price|property facts?)\b/.test(text)) flags.push("property_fact_request");
  if (/\b(weather|joke|recipe|homework|sports score)\b/.test(text)) flags.push("off_topic");

  return dedupeFlags(flags);
}

export function sanitizePlainReply(value: string, fallback: string) {
  const cleaned = value
    .replace(/[`*_>#]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxReplyChars);

  return cleaned || fallback;
}

export function buildSafetyReply(flags: AiSafetyFlag[], nextQuestion: string) {
  const primaryFlag = flags[0];
  let guidance = "I can help collect your real estate goals, but I need to keep this to lead intake for the agent.";

  if (primaryFlag === "legal_advice" || primaryFlag === "tax_advice" || primaryFlag === "mortgage_or_financial_advice") {
    guidance = "I cannot give legal, tax, mortgage, or financial advice. A licensed professional can help with that.";
  } else if (primaryFlag === "fair_housing_sensitive") {
    guidance = "I cannot guide choices based on protected-class traits. I can help with budget, commute, amenities, property type, and areas you name.";
  } else if (primaryFlag === "property_fact_request") {
    guidance = "I do not want to invent property, listing, MLS, pricing, or availability details. The agent can confirm those facts.";
  }

  return sanitizePlainReply(`${guidance} ${nextQuestion}`, nextQuestion);
}

export function buildUserPrompt({
  previousState,
  deterministicResult,
  visitorMessage,
  retrieval,
}: {
  previousState: ChatState | null | undefined;
  deterministicResult: ChatTurnResult;
  visitorMessage: string;
  retrieval?: RetrievalContext;
}) {
  return JSON.stringify({
    visitorMessage: visitorMessage.slice(0, 2000),
    previousState: redactStateForPrompt(previousState),
    appDecision: {
      nextStep: deterministicResult.state.step,
      requiredReplyIntent: deterministicResult.completed ? "complete_capture" : "ask_next_question",
      deterministicReply: deterministicResult.reply,
      leadSummary: redactLeadForPrompt(deterministicResult.lead),
      score: deterministicResult.score,
      status: deterministicResult.status,
    },
    controlledSources: {
      propertyCards: retrieval?.propertyCards.map((card) => ({
        id: card.id,
        title: card.title,
        priceLabel: card.priceLabel,
        location: card.location,
        details: card.details,
        description: card.description,
      })) ?? [],
      knowledgeSnippets: retrieval?.knowledgeSnippets ?? [],
    },
    instructions: [
      "Return only the structured output requested by the schema.",
      "Keep the reply plain text, short, and friendly.",
      "Do not change the app decision, lead fields, score, status, workspace, bot, channel, or conversation.",
      "Use only controlledSources for property or knowledge facts. If controlledSources are empty, say the information is not in the agent-provided info.",
      "Ask the deterministic reply question unless a safety redirect or controlled-source answer is required.",
    ],
  });
}

function buildSystemPrompt(bot: AiChatBotConfig) {
  return [
    `You are ${bot.name}'s real estate lead capture assistant.`,
    "The app owns all state, validation, scoring, persistence, workspace authorization, and lead fields.",
    "You may only improve the natural-language reply and return safety metadata.",
    "Never invent property, listing, MLS, pricing, availability, valuation, tax, legal, mortgage, or financial facts.",
    "When controlled properties or knowledge snippets are provided, you may reference only those exact facts.",
    "Do not give legal, tax, mortgage, financial, investment, or fair-housing-sensitive advice.",
    "For fair housing, do not steer by protected traits. Redirect to neutral criteria such as budget, commute, property type, amenities, and user-named areas.",
    "Use plain text only. No markdown. No links. No promises. No claims that a human agent has already acted.",
  ].join(" ");
}

async function generateAiText({ modelId, system, prompt, timeoutMs }: AiGenerateInput): Promise<AiGenerateResult> {
  const result = await generateText({
    model: openai(modelId),
    system,
    prompt,
    output: Output.object({
      schema: aiChatOutputSchema,
      name: "real_estate_lead_reply",
      description: "A safe plain-text chatbot reply and safety metadata for real estate lead capture.",
    }),
    maxOutputTokens: 350,
    temperature: 0.2,
    maxRetries: 1,
    timeout: { totalMs: timeoutMs },
    providerOptions: { openai: { store: false } },
  });

  return { output: result.output, usage: result.totalUsage };
}

function deterministicTurn(
  result: ChatTurnResult,
  options: Pick<AiTurnMetadata, "enabled" | "model" | "fallbackReason" | "safetyFlags" | "mode"> & { latencyMs?: number; retrieval?: AiTurnMetadata["retrieval"] },
): AiChatTurn {
  return {
    result,
    metadata: {
      phase: 3,
      provider: options.enabled ? "openai" : undefined,
      validation: "fallback",
      ...options,
    },
  };
}

function freezeLeadStateForSafety(previousState: ChatState | null | undefined, flags: AiSafetyFlag[]): ChatTurnResult {
  const state: ChatState = previousState ?? { step: "intent", lead: {} };
  const lead = state.lead ?? {};
  const score = scoreLead(lead);
  const classified = classifyLead(score);
  const nextQuestion = questionForStep(state.step, lead.intent);

  return {
    reply: buildSafetyReply(flags, nextQuestion),
    state,
    lead,
    completed: false,
    score,
    ...classified,
  };
}

function resolveModelId(config: Record<string, unknown> | null | undefined) {
  const configured = typeof config?.model === "string" ? config.model : undefined;
  const fromEnv = process.env.OPENAI_CHAT_MODEL;
  const candidate = configured || fromEnv || defaultModel;

  return /^[a-zA-Z0-9._:-]{2,80}$/.test(candidate) ? candidate : defaultModel;
}

function redactStateForPrompt(state: ChatState | null | undefined) {
  if (!state) return null;

  return {
    step: state.step,
    lead: redactLeadForPrompt(state.lead ?? {}),
  };
}

function redactLeadForPrompt(lead: LeadDraft) {
  return {
    intent: lead.intent,
    budgetMin: lead.budgetMin,
    budgetMax: lead.budgetMax,
    location: lead.location,
    timeframe: lead.timeframe,
    propertyType: lead.propertyType,
    preApproved: lead.preApproved,
    propertyAddress: lead.propertyAddress ? "provided" : undefined,
    wantsValuation: lead.wantsValuation,
    hasName: Boolean(lead.name),
    hasEmail: Boolean(lead.email),
    hasPhone: Boolean(lead.phone),
  };
}

function dedupeFlags(flags: readonly AiSafetyFlag[]) {
  return [...new Set(flags)];
}

function toJsonSafe(value: unknown) {
  if (value == null) return undefined;

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return undefined;
  }
}
