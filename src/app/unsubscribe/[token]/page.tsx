import Link from "next/link";
import { unsubscribeFollowUp } from "@/app/unsubscribe/actions";

type UnsubscribePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function UnsubscribePage({ params, searchParams }: UnsubscribePageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const saved = query.saved === "1";
  const tokenLooksValid = token.length >= 20 && token.length <= 200;

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-5 py-16 text-[#162018]">
      <section className="mx-auto max-w-xl rounded-lg border border-[#d9ded2] bg-white p-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#657064]">Email preferences</p>
        <h1 className="mt-3 text-3xl font-semibold">Unsubscribe from follow-up email</h1>
        {saved ? (
          <div className="mt-5 rounded-md border border-[#bcd7c8] bg-[#edf7f1] p-4 text-sm leading-6 text-[#173f2f]">
            No further automated follow-up emails will be sent from this assistant when the link matches an active preference.
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-[#657064]">
              Confirm that you want to stop automated follow-up email from this real estate assistant. This page does not reveal whether an email address is on file.
            </p>
            <form action={unsubscribeFollowUp} className="mt-5">
              <input name="token" type="hidden" value={token} />
              <button className="h-11 rounded-md bg-[#173f2f] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!tokenLooksValid} type="submit">
                Unsubscribe
              </button>
            </form>
          </>
        )}
        <Link className="mt-5 inline-block text-sm font-semibold text-[#2861a8]" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
