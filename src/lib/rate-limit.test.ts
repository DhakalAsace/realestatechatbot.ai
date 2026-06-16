import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clearRateLimitBuckets, reservePersistentRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => clearRateLimitBuckets());

  it("blocks after the configured limit until reset", () => {
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 0 }).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 10 }).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 20 }).allowed).toBe(false);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 1001 }).allowed).toBe(true);
  });
});

describe("reservePersistentRateLimit", () => {
  it("normalizes the Supabase RPC response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, remaining: 4, reset_at: "2026-06-16T00:00:00.000Z" }], error: null });

    const result = await reservePersistentRateLimit({ rpc }, { key: "chat:test", limit: 5, windowSeconds: 60 });

    expect(result).toEqual({ ok: true, allowed: true, remaining: 4, resetAt: "2026-06-16T00:00:00.000Z" });
    expect(rpc).toHaveBeenCalledWith("reserve_public_rate_limit", { p_bucket_key: "chat:test", p_limit: 5, p_window_seconds: 60 });
  });

  it("fails closed on RPC errors or malformed data", async () => {
    await expect(reservePersistentRateLimit({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } }) }, { key: "chat:test", limit: 5, windowSeconds: 60 })).resolves.toEqual({ ok: false, error: "db down" });
    await expect(reservePersistentRateLimit({ rpc: vi.fn().mockResolvedValue({ data: [{ nope: true }], error: null }) }, { key: "chat:test", limit: 5, windowSeconds: 60 })).resolves.toEqual({ ok: false, error: "rate_limit_rpc_invalid_response" });
  });
});
