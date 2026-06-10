import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/env";
import { webSocketTransport } from "@/lib/supabase/websocket";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: webSocketTransport,
      },
    });
  }

  return adminClient;
}
