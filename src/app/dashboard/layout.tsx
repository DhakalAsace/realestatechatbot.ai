import Link from "next/link";
import { signOut } from "@/app/dashboard/actions";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[#f5f7f2] text-[#162018]">
      <header className="border-b border-[#d9ded2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="text-lg font-semibold" href="/dashboard">
              RealEstateChatbot.ai
            </Link>
            <p className="text-sm text-[#657064]">{user.email}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-medium hover:bg-[#f2f5ee]" href="/dashboard">
              Overview
            </Link>
            <Link className="rounded-md border border-[#cbd5c7] bg-white px-3 py-2 font-medium hover:bg-[#f2f5ee]" href="/dashboard/leads">
              Leads
            </Link>
            <form action={signOut}>
              <button className="rounded-md bg-[#162018] px-3 py-2 font-medium text-white hover:bg-[#2d392f]" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
