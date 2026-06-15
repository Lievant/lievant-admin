export default function SalasLoading() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 animate-pulse rounded-md bg-slate-200" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-slate-100" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
