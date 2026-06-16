import Link from "next/link";
import { acceptWorkspaceInvitation } from "@/app/dashboard/actions";
import { getCurrentUser } from "@/lib/auth";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const errorText: Record<string, string> = {
  accept: "This invite could not be accepted. It may be expired, already used, revoked, or tied to a different email.",
};

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const [{ token }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const error = query.error ? errorText[query.error] ?? "Invite acceptance failed." : null;
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-8 text-[#162018]">
      <section className="mx-auto mt-20 max-w-xl rounded-lg border border-[#d9ded2] bg-white p-8 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Workspace invite</p>
        <h1 className="mt-3 text-3xl font-semibold">Join a RealEstateChatbot.ai workspace</h1>
        <p className="mt-3 text-sm leading-6 text-[#657064]">
          Invitations are email-bound and single-use. Sign in with the invited email, then accept the workspace access below.
        </p>

        {error ? <p className="mt-5 rounded-md bg-[#fff1eb] px-4 py-3 text-sm font-medium text-[#8a3518]">{error}</p> : null}

        {user ? (
          <form action={acceptWorkspaceInvitation} className="mt-6">
            <input name="token" type="hidden" value={token} />
            <p className="mb-4 rounded-md bg-[#f8faf6] px-4 py-3 text-sm text-[#657064]">Signed in as <span className="font-semibold text-[#162018]">{user.email}</span></p>
            <button className="h-12 rounded-md bg-[#173f2f] px-5 font-semibold text-white" type="submit">
              Accept invite
            </button>
          </form>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="inline-flex h-12 items-center rounded-md bg-[#173f2f] px-5 font-semibold text-white" href={loginHref}>
              Sign in to accept
            </Link>
            <Link className="inline-flex h-12 items-center rounded-md border border-[#cbd5c7] bg-white px-5 font-semibold" href="/">
              Back home
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
