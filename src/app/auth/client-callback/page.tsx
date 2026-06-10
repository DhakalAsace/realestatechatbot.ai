import { Suspense } from "react";
import { AuthCallbackClient } from "@/app/auth/client-callback/callback-client";

export default function ClientCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8f3] px-5 text-[#162018]">
          <div className="rounded-lg border border-[#d9ded2] bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Signing you in</h1>
            <p className="mt-2 text-sm text-[#5f685e]">Loading the secure email link.</p>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
