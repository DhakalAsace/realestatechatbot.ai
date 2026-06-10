"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function safeNext(value: string | null) {
  return value && value.startsWith("/") ? value : "/dashboard";
}

function getFailureReason(error: { message?: string; code?: string }) {
  const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  if (value.includes("verifier") || value.includes("flow") || value.includes("expired")) {
    return "expired-link";
  }

  if (value.includes("invalid")) {
    return "invalid-link";
  }

  return "auth-callback";
}

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    const code = searchParams.get("code");
    const next = safeNext(searchParams.get("next"));

    if (!code) {
      router.replace("/login?error=auth-callback");
      return;
    }
    const authCode = code;

    async function exchangeCode() {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(authCode);

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Supabase auth callback exchange failed", {
          code: error.code,
          message: error.message,
          name: error.name,
          status: error.status,
        });
        router.replace(`/login?error=${getFailureReason(error)}`);
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void exchangeCode();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f3] px-5 text-[#162018]">
      <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Signing you in</h1>
        <p className="mt-2 text-sm text-[#5f685e]">One moment while we finish the secure email link.</p>
      </div>
    </main>
  );
}
