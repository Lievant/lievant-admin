import Link from 'next/link';
import { TableIcon } from '@/components/icons';

export default function ReportesFinanzasPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-black">Finanzas</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Reportes</h1>
        <p className="mt-2 text-sm text-slate-500">Análisis de cartera de clientes y documentación</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/finanzas/reportes/documentos-faltantes"
          className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-black/40 hover:shadow-md"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-100">
            <TableIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-semibold text-navy">Documentos faltantes</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Clientes con documentos obligatorios incompletos, con exportación a Excel
            </p>
          </div>
        </Link>

        <div className="flex items-start gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 opacity-60">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <TableIcon className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-400">Próximamente</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                Próximamente
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">Más reportes disponibles próximamente</p>
          </div>
        </div>
      </div>
    </div>
  );
}
