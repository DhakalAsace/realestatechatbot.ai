import { describe, expect, it } from "vitest";
import { createConversationSession, createWidgetChannelToken, parseConversationSession, verifyWidgetChannelToken } from "@/lib/security";

process.env.CHAT_WIDGET_TOKEN_SECRET = "unit-test-widget-secret";

describe("conversation session tokens", () => {
  it("round-trips generated UUID session ids", () => {
    const session = createConversationSession();

    expect(parseConversationSession(session.token)).toEqual({
      id: session.id,
      tokenHash: session.tokenHash,
    });
  });
});

describe("widget channel tokens", () => {
  it("verifies signed channel/origin payloads", () => {
    const token = createWidgetChannelToken({ channelKey: "0123456789abcdef0123456789abcdef", origin: "https://agent.example" });
    expect(verifyWidgetChannelToken(token)).toMatchObject({
      channelKey: "0123456789abcdef0123456789abcdef",
      origin: "https://agent.example",
    });
  });

  it("rejects tampered and expired tokens", () => {
    const token = createWidgetChannelToken({ channelKey: "0123456789abcdef0123456789abcdef", origin: "https://agent.example" });
    expect(verifyWidgetChannelToken(`${token}x`)).toBeNull();

    const expired = createWidgetChannelToken({ channelKey: "0123456789abcdef0123456789abcdef", origin: "https://agent.example", ttlSeconds: -1 });
    expect(verifyWidgetChannelToken(expired)).toBeNull();
  });

  it("requires an explicit widget origin before signing", () => {
    expect(() => createWidgetChannelToken({ channelKey: "0123456789abcdef0123456789abcdef", origin: "*" })).toThrow(/explicit/);
  });
});
