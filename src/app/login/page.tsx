import Link from "next/link";
import { requestMagicLink } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const email = params.email;
  const error = params.error;
  const next = params.next ?? "/dashboard";

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-8 text-[#162018]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-[#d9ded2] bg-white shadow-sm md:grid-cols-[1fr_1.1fr]">
          <div className="border-b border-[#e5e9df] bg-[#173f2f] p-8 text-white md:border-b-0 md:border-r">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#bcd7c8]">Agent login</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight">Open your hosted lead bot dashboard.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#d7e6dc]">
              Sign in with a secure email link, finish the Sarah Patel sample setup, and test buyer/seller lead capture from the hosted bot URL.
            </p>
          </div>

          <div className="p-8">
            <Link className="text-sm font-medium text-[#2861a8]" href="/">
              Back to home
            </Link>
            <h2 className="mt-8 text-2xl font-semibold">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f685e]">
              We will email a magic link. No password or OAuth setup needed for Phase 1.
            </p>

            {sent ? (
              <div className="mt-6 rounded-lg border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm text-[#173f2f]">
                Magic link sent{email ? ` to ${email}` : ""}. Open it on this device to continue.
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-lg border border-[#f0c0aa] bg-[#fff1eb] p-4 text-sm text-[#8a3518]">
                Sign-in could not complete. Check Supabase auth settings and try again.
              </div>
            ) : null}

            <form action={requestMagicLink} className="mt-6 space-y-4">
              <input name="next" type="hidden" value={next} />
              <label className="block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                className="h-12 w-full rounded-md border border-[#cdd5c8] px-3 text-base outline-none ring-[#2861a8]/20 focus:border-[#2861a8] focus:ring-4"
                id="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
              <button className="h-12 w-full rounded-md bg-[#173f2f] px-4 font-semibold text-white transition hover:bg-[#0f3325]" type="submit">
                Send magic link
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
