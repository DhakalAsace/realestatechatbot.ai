import { NextResponse, type NextRequest } from "next/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const target = new URL("/auth/client-callback", url.origin);
    target.searchParams.set("code", code);
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL("/login?error=auth-callback", url.origin));
}
