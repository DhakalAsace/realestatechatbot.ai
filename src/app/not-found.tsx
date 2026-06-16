import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f2] px-5 text-[#162018]">
      <div className="max-w-md rounded-lg border border-[#d9ded2] bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#657064]">This route is not available or the hosted bot is not active.</p>
        <Link className="mt-5 inline-flex rounded-md bg-[#173f2f] px-4 py-2 text-sm font-semibold text-white" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
