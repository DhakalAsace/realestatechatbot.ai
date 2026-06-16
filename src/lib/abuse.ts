const urlPattern = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|ai|co|info)\b/gi;
const controlCharPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const repeatedCharPattern = /(.)\1{80,}/;
const htmlInjectionPattern = /<\s*(script|iframe|object|embed|style|svg)|javascript\s*:/i;
const promptExtractionPattern = /\b(ignore (all )?(previous|above) instructions|system prompt|developer message|service[_ -]?role|api[_ -]?key|supabase secret|openai key|reveal your instructions)\b/i;
const spamWordPattern = /\b(crypto giveaway|loan approval guaranteed|wire transfer|casino bonus|rank first on google|buy followers)\b/i;

export const maxChatPayloadBytes = 12_000;

export type ChatAbuseCode = "empty" | "link_flood" | "control_chars" | "repeated_chars" | "html_injection" | "prompt_extraction" | "spam_keywords" | "oversized_payload";

export type ChatAbuseResult =
  | { allowed: true; code?: never; reason?: never; status?: never }
  | { allowed: false; code: ChatAbuseCode; reason: string; status: 400 | 413 };

export type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; code: "oversized_payload"; reason: string; status: 413 };

export function checkChatAbuse(message: string): ChatAbuseResult {
  const trimmed = message.trim();
  if (!trimmed) return blocked("empty", "Chat message is empty.", 400);

  const linkCount = [...trimmed.matchAll(urlPattern)].length;
  if (linkCount > 3) return blocked("link_flood", "Chat message contains too many links.", 400);
  if (controlCharPattern.test(trimmed)) return blocked("control_chars", "Chat message contains control characters.", 400);
  if (repeatedCharPattern.test(trimmed)) return blocked("repeated_chars", "Chat message contains repeated characters.", 400);
  if (htmlInjectionPattern.test(trimmed)) return blocked("html_injection", "Chat message contains unsafe markup.", 400);
  if (promptExtractionPattern.test(trimmed)) return blocked("prompt_extraction", "Chat message attempts to extract system instructions or secrets.", 400);
  if (spamWordPattern.test(trimmed)) return blocked("spam_keywords", "Chat message matches spam patterns.", 400);

  return { allowed: true };
}

export function checkContentLength(value: string | null): ChatAbuseResult {
  if (!value) return { allowed: true };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= maxChatPayloadBytes) return { allowed: true };
  return blocked("oversized_payload", "Chat request payload is too large.", 413);
}

export async function readJsonWithByteLimit(request: Request, maxBytes = maxChatPayloadBytes): Promise<LimitedJsonResult> {
  if (!request.body) return { ok: true, value: null };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: "oversized_payload", reason: "Chat request payload is too large.", status: 413 };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: true, value: null };
  } finally {
    reader.releaseLock();
  }

  try {
    if (byteLength === 0) return { ok: true, value: null };

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: true, value: null };
  }
}

function blocked(code: ChatAbuseCode, reason: string, status: 400 | 413): ChatAbuseResult {
  return { allowed: false, code, reason, status };
}
