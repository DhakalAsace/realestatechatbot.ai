import { describe, expect, it, vi } from "vitest";
import { createRouteLogger, sanitizeLogFields, scrubSensitiveText } from "@/lib/observability";

describe("observability logging", () => {
  it("scrubs secrets, emails, and phone numbers", () => {
    const text = scrubSensitiveText("Email maya@example.com key sk-proj-abcdefghijklmnop phone +1 204 555 0199");
    expect(text).toContain("[email]");
    expect(text).toContain("[secret]");
    expect(text).toContain("[phone]");
  });

  it("sanitizes nested log fields", () => {
    expect(sanitizeLogFields({ user: { email: "agent@example.com" } })).toEqual({ user: { email: "[email]" } });
  });

  it("emits structured request completion logs", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    createRouteLogger({ route: "/api/test", requestId: "req_1", startedAt: Date.now() }).done(200, { path: "/ok" });
    const line = spy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({ level: "info", event: "request_done", route: "/api/test", requestId: "req_1", status: 200 });
    spy.mockRestore();
  });
});
