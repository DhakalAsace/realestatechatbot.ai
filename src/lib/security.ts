import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { getChatWidgetTokenSecret } from "@/lib/env";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
