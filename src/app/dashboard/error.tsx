"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="rounded-lg border border-[#f0c0aa] bg-white p-6">
        <h1 className="text-2xl font-semibold">Dashboard could not load</h1>
        <p className="mt-3 text-sm leading-6 text-[#657064]">Check Supabase environment variables, migrations, and auth redirect settings.</p>
        <button className="mt-5 rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
          Try again
        </button>
      </div>
    </main>
  );
}
