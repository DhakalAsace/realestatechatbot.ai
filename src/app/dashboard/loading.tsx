export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[#d9ded2]" />
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-28 animate-pulse rounded-lg bg-[#e8ece2]" key={index} />
        ))}
      </div>
    </main>
  );
}
