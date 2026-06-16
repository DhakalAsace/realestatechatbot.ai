import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NextRequest } from "next/server";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
    },
  })),
}));
function nextRequest(url: string) {
  return new Request(url) as unknown as NextRequest;
}


describe("GET /auth/confirm", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
  });

  it("redirects successful code exchanges to safe dashboard paths", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(
      nextRequest("https://app.example/auth/confirm?code=abc&next=/dashboard/leads?status=qualified"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://app.example/dashboard/leads?status=qualified");
  });

  it("falls back to dashboard when next is not an allowed dashboard path", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(nextRequest("https://app.example/auth/confirm?code=abc&next=/login"));

    expect(response.headers.get("location")).toBe("https://app.example/dashboard");
  });

  it("redirects successful OTP verification to safe dashboard paths", async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const response = await GET(
      nextRequest("https://app.example/auth/confirm?token_hash=tok&type=email&next=/dashboard/settings"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "tok" });
    expect(response.headers.get("location")).toBe("https://app.example/dashboard/settings");
  });

  it("redirects failed confirmations to login", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("bad code") });

    const response = await GET(nextRequest("https://app.example/auth/confirm?code=bad&next=/dashboard"));

    expect(response.headers.get("location")).toBe("https://app.example/login?error=auth-confirm");
  });
});
