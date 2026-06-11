import WebSocket from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

export const webSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;
