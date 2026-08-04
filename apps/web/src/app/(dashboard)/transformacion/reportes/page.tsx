import Link from 'next/link';
import { LaptopIcon } from '@/components/icons';

export default function ReportesTdPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-black">Transformación Digital</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Reportes</h1>
        <p className="mt-2 text-sm text-slate-500">Inventario tecnológico y métricas del área</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/transformacion/reportes/inventario-por-area"
          className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-black/40 hover:shadow-md"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
            <LaptopIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-semibold text-navy">Inventario por área</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Equipos asignados agrupados por área y empleado, con exportación PDF
            </p>
          </div>
        </Link>

        <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 opacity-60">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <span className="text-xl">📊</span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-500">Tickets por categoría</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                Próximamente
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              Análisis de tickets por categoría, prioridad y tiempo de resolución
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
