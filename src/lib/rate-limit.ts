type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type PersistentRateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export type PersistentRateLimitClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type PersistentRateLimitResult =
  | { ok: true; allowed: boolean; remaining: number; resetAt: string }
  | { ok: false; error: string };

export function checkRateLimit({ key, limit, windowMs, now = Date.now() }: RateLimitOptions) {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

export async function reservePersistentRateLimit(client: PersistentRateLimitClient, { key, limit, windowSeconds }: PersistentRateLimitOptions): Promise<PersistentRateLimitResult> {
  if (!key || limit < 1 || windowSeconds < 1) {
    return { ok: false, error: "invalid_rate_limit_config" };
  }

  const { data, error } = await client.rpc("reserve_public_rate_limit", {
    p_bucket_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    return { ok: false, error: error.message ?? "rate_limit_rpc_failed" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { ok: false, error: "rate_limit_rpc_invalid_response" };
  }

  const value = row as { allowed?: unknown; remaining?: unknown; reset_at?: unknown };
  if (typeof value.allowed !== "boolean" || typeof value.remaining !== "number" || typeof value.reset_at !== "string") {
    return { ok: false, error: "rate_limit_rpc_invalid_response" };
  }

  return { ok: true, allowed: value.allowed, remaining: value.remaining, resetAt: value.reset_at };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
