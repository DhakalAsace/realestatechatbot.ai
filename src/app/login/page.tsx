import Link from "next/link";
import { Suspense } from "react";
import { authenticateWithPassword } from "@/app/login/actions";
import { GoogleButton } from "@/app/login/google-button";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const errorMessages: Record<string, string> = {
  "auth-callback": "Sign-in could not complete. Try again or use email and password.",
  "auth-confirm": "Sign-in could not complete. Try again or use email and password.",
  "expired-link": "That sign-in link expired or was already used. Use email and password instead.",
  "invalid-credentials": "Enter a valid email and a password with at least 8 characters.",
  "invalid-link": "That sign-in link is invalid or was already used. Use email and password instead.",
  "signin-failed": "Email or password was incorrect, or this account uses Google sign-in.",
  "signup-failed": "Account creation failed. This email may already be registered, or the password may be too weak.",
};

const noticeMessages: Record<string, string> = {
  "confirm-email": "Account created. Check your email to confirm before signing in.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const email = params.email;
  const error = params.error;
  const notice = params.notice;
  const next = params.next ?? "/dashboard";
  const errorMessage = error ? (errorMessages[error] ?? "Sign-in could not complete. Try again.") : null;
  const noticeMessage = notice ? noticeMessages[notice] : null;

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-8 text-[#162018]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-[#d9ded2] bg-white shadow-sm md:grid-cols-[1fr_1.1fr]">
          <div className="border-b border-[#e5e9df] bg-[#173f2f] p-8 text-white md:border-b-0 md:border-r">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#bcd7c8]">Agent login</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight">Open your hosted lead bot dashboard.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#d7e6dc]">
              Sign in with Google or create an email/password account, finish the Sarah Patel sample setup, and test buyer/seller lead capture from the hosted bot URL.
            </p>
          </div>

          <div className="p-8">
            <Link className="text-sm font-medium text-[#2861a8]" href="/">
              Back to home
            </Link>
            <h2 className="mt-8 text-2xl font-semibold">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f685e]">
              Use Google for the fastest setup, or use email and password if you prefer a direct account.
            </p>

            {noticeMessage ? (
              <div className="mt-6 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]">
                {noticeMessage}{email ? " (" + email + ")" : ""}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-6 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6">
              <Suspense fallback={<div className="h-12 rounded-md border border-[#cdd5c8] bg-[#f7f9f4]" />}>
                <GoogleButton />
              </Suspense>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-[#7b8578]">
              <span className="h-px flex-1 bg-[#e1e6dc]" />
              Email
              <span className="h-px flex-1 bg-[#e1e6dc]" />
            </div>

            <form action={authenticateWithPassword} className="space-y-4">
              <input name="next" type="hidden" value={next} />
              <label className="block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-md border border-[#cdd5c8] px-3 text-base outline-none ring-[#2861a8]/20 focus:border-[#2861a8] focus:ring-4"
                defaultValue={email ?? ""}
                id="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
              <label className="block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                autoComplete="current-password"
                className="h-12 w-full rounded-md border border-[#cdd5c8] px-3 text-base outline-none ring-[#2861a8]/20 focus:border-[#2861a8] focus:ring-4"
                id="password"
                minLength={8}
                name="password"
                placeholder="At least 8 characters"
                required
                type="password"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="h-12 rounded-md bg-[#173f2f] px-4 font-semibold text-white transition hover:bg-[#0f3325]"
                  name="mode"
                  type="submit"
                  value="sign-in"
                >
                  Sign in
                </button>
                <button
                  className="h-12 rounded-md border border-[#cdd5c8] bg-white px-4 font-semibold text-[#162018] transition hover:bg-[#f7f9f4]"
                  name="mode"
                  type="submit"
                  value="sign-up"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
