export default function ClientesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-md bg-slate-200" />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="h-9 min-w-[240px] flex-1 animate-pulse rounded-md bg-slate-100" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-9 w-40 animate-pulse rounded-md bg-slate-100" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-none">
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="ml-auto h-6 w-20 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
