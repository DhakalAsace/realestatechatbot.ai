import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitBuckets } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => clearRateLimitBuckets());

  it("blocks after the configured limit until reset", () => {
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 0 }).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 10 }).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 20 }).allowed).toBe(false);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000, now: 1001 }).allowed).toBe(true);
  });
});
