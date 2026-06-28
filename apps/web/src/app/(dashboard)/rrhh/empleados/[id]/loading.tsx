export default function EmployeeDetailLoading() {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
          <div>
            <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-9 w-24 animate-pulse rounded-md bg-slate-200" />
      </header>

      <div className="mt-6 flex gap-6 border-b border-slate-200 pb-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-4 w-24 animate-pulse rounded bg-slate-100" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j}>
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
