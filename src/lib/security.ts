import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getChatWidgetTokenSecret } from "@/lib/env";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const widgetTokenVersion = "v1";

type WidgetChannelTokenPayload = {
  version: typeof widgetTokenVersion;
  channelKey: string;
  origin: string;
  exp: number;
  nonce: string;
};

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashConversationSecret(secret: string) {
  return createHmac("sha256", getChatWidgetTokenSecret()).update(secret).digest("hex");
}

export function createConversationSession() {
  const id = randomUUID();
  const secret = randomBytes(24).toString("base64url");

  return {
    id,
    token: `${id}.${secret}`,
    tokenHash: hashConversationSecret(secret),
  };
}

export function parseConversationSession(token: string) {
  const [id, secret, extra] = token.split(".");

  if (!id || !secret || extra || !uuidPattern.test(id)) {
    return null;
  }

  return {
    id,
    tokenHash: hashConversationSecret(secret),
  };
}

export function createWidgetChannelToken({
  channelKey,
  origin,
  ttlSeconds = 4 * 60 * 60,
}: {
  channelKey: string;
  origin: string;
  ttlSeconds?: number;
}) {
  if (!origin.trim() || origin === "*") {
    throw new Error("Widget token origin must be explicit.");
  }

  const payload: WidgetChannelTokenPayload = {
    version: widgetTokenVersion,
    channelKey,
    origin,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: randomBytes(12).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signWidgetPayload(encodedPayload)}`;
}

export function verifyWidgetChannelToken(token: string | null | undefined) {
  if (!token) return null;

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = signWidgetPayload(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<WidgetChannelTokenPayload>;
    if (payload.version !== widgetTokenVersion) return null;
    if (typeof payload.channelKey !== "string" || typeof payload.origin !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      channelKey: payload.channelKey,
      origin: payload.origin,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function signWidgetPayload(encodedPayload: string) {
  return createHmac("sha256", getChatWidgetTokenSecret()).update(encodedPayload).digest("base64url");
}
