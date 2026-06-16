import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { buildChannelUrl } from "@/lib/channels";
import { getAppUrl } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QRRouteProps = {
  params: Promise<{ channelId: string }>;
};

type ChannelRow = {
  id: string;
  bot_id: string;
  public_key: string;
  type: string;
  status: string;
};

type BotRow = {
  id: string;
  slug: string;
  status: string;
};

export async function GET(_request: Request, { params }: QRRouteProps) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { channelId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: channel } = await supabase
    .from("bot_channels")
    .select("id, bot_id, public_key, type, status")
    .eq("id", channelId)
    .eq("type", "qr_code")
    .eq("status", "active")
    .maybeSingle<ChannelRow>();

  if (!channel) {
    return new Response("Not found", { status: 404 });
  }

  const { data: bot } = await supabase
    .from("bots")
    .select("id, slug, status")
    .eq("id", channel.bot_id)
    .eq("status", "active")
    .maybeSingle<BotRow>();
  if (!bot) {
    return new Response("Not found", { status: 404 });
  }

  const svg = await QRCode.toString(buildChannelUrl(getAppUrl(), bot.slug, channel.public_key), {
    margin: 2,
    type: "svg",
    width: 512,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${bot.slug}-qr.svg"`,
    },
  });
}
