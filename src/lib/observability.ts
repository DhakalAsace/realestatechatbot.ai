import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const secretPattern = /\b(sk-[A-Za-z0-9_-]{12,}|sk-proj-[A-Za-z0-9_-]{12,}|whsec_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,})\b/g;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function requestIdFromHeaders(headers: Pick<Headers, "get">) {
  return headers.get("x-vercel-id") || headers.get("x-request-id") || randomUUID();
}

export function createRouteLogger({ route, requestId = randomUUID(), startedAt = Date.now() }: { route: string; requestId?: string; startedAt?: number }) {
  const base = { route, requestId };
  return {
    info(event: string, fields: LogFields = {}) {
      logEvent("info", event, { ...base, ...fields });
    },
    warn(event: string, fields: LogFields = {}) {
      logEvent("warn", event, { ...base, ...fields });
    },
    error(event: string, error: unknown, fields: LogFields = {}) {
      logEvent("error", event, { ...base, ...fields, error: errorMessage(error) });
    },
    done(status: number, fields: LogFields = {}) {
      logEvent(status >= 500 ? "error" : "info", "request_done", { ...base, ...fields, status, durationMs: Date.now() - startedAt });
    },
  };
}

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = sanitizeLogFields({ level, event, at: new Date().toISOString(), ...fields });
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function sanitizeLogFields(fields: LogFields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeValue(value)]));
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return scrubSensitiveText(value).slice(0, 600);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      output[key] = sanitizeValue(item);
    }
    return output;
  }
  return String(value);
}

export function scrubSensitiveText(value: string) {
  return value
    .replace(secretPattern, "[secret]")
    .replace(emailPattern, "[email]")
    .replace(phonePattern, "[phone]");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "unknown");
}
