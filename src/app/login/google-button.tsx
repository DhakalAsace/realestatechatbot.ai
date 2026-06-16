"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function safeNext(value: string | null) {
  return value?.startsWith("/") ? value : "/dashboard";
}

export function GoogleButton() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function continueWithGoogle() {
    setError(null);
    setLoading(true);

    const next = safeNext(searchParams.get("next"));
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setLoading(false);
      setError("Google sign-in is not ready yet. Check the Google OAuth provider settings.");
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#cdd5c8] bg-white px-4 font-semibold text-[#162018] transition hover:bg-[#f7f9f4] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={loading}
        onClick={continueWithGoogle}
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#cdd5c8] text-xs font-bold text-[#2861a8]">G</span>
        {loading ? "Opening Google..." : "Continue with Google"}
      </button>
      {error ? <p className="text-sm text-[#8a3518]">{error}</p> : null}
    </div>
  );
}
