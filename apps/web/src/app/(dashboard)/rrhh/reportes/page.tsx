import Link from 'next/link';
import { CakeIcon, ContractIcon } from '@/components/icons';

export default function ReportesRrhhPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">RRHH</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Reportes</h1>
        <p className="mt-2 text-sm text-slate-500">Análisis de plantilla y estadísticas del equipo</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/rrhh/reportes/cumpleanos"
          className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-terracota/40 hover:shadow-md"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600 transition group-hover:bg-pink-100">
            <CakeIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-semibold text-navy">Cumpleaños del mes</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Empleados que cumplen años en un mes dado, con filtro y exportación
            </p>
          </div>
        </Link>

        <Link
          href="/rrhh/reportes/contratos"
          className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-terracota/40 hover:shadow-md"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-100">
            <ContractIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-semibold text-navy">Contratos por vencer</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Empleados con contrato próximo a vencer, filtro por período y exportación
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
