'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { VacationReportRow } from '@/lib/api';
import { ChevronLeftIcon, PlaneIcon, TableIcon } from '@/components/icons';

interface Props {
  rows: VacationReportRow[];
  startDate: string;
  endDate: string;
}

function currency(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function VacationReportScreen({ rows, startDate, endDate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  function applyFilters() {
    startTransition(() => {
      router.push(`/rrhh/reportes/vacaciones?startDate=${start}&endDate=${end}`);
    });
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.daysInRange += r.daysInRange;
      acc.prima += r.primaVacacional ?? 0;
      return acc;
    },
    { daysInRange: 0, prima: 0 },
  );

  function exportExcel() {
    const data = rows.map((r) => ({
      Folio: r.displayId,
      Empleado: r.fullName,
      Área: r.area ?? '',
      Inicio: r.startDate.slice(0, 10),
      Fin: r.endDate.slice(0, 10),
      'Días en período': r.daysInRange,
      'Días fuera de período': r.daysOutsideRange,
      'Salario diario': r.dailySalary ?? '',
      'Prima vacacional': r.primaVacacional ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vacaciones');
    XLSX.writeFile(wb, `vacaciones_${start}_${end}.xlsx`);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-6 print:hidden">
        <Link
          href="/rrhh/reportes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes RRHH
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-terracota">RRHH · Reportes</p>
            <h1 className="text-2xl font-bold text-navy">Vacaciones para nómina</h1>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
          />
        </div>
        <button
          onClick={applyFilters}
          disabled={isPending || !start || !end}
          className="rounded-lg bg-terracota px-4 py-2 text-sm font-semibold text-white transition hover:bg-terracota-dark disabled:opacity-50"
        >
          {isPending ? 'Cargando…' : 'Aplicar'}
        </button>

        <button
          onClick={exportExcel}
          disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <TableIcon className="h-4 w-4" />
          Excel
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center">
          <PlaneIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-400">
            No hay vacaciones aprobadas que crucen el período seleccionado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Empleado</th>
                <th className="px-4 py-3 text-left">Área</th>
                <th className="px-4 py-3 text-left">Fechas</th>
                <th className="px-4 py-3 text-right">Días en período</th>
                <th className="px-4 py-3 text-right">Días fuera</th>
                <th className="px-4 py-3 text-right">Salario diario</th>
                <th className="px-4 py-3 text-right">Prima vacacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.requestId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.displayId}</td>
                  <td className="px-4 py-3 font-medium text-navy">{r.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{r.area ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.startDate.slice(0, 10)} – {r.endDate.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-navy">{r.daysInRange}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.daysOutsideRange}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{currency(r.dailySalary)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {currency(r.primaVacacional)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-navy">
              <tr>
                <td className="px-4 py-3" colSpan={4}>
                  Totales ({rows.length} registro{rows.length === 1 ? '' : 's'})
                </td>
                <td className="px-4 py-3 text-right">{totals.daysInRange}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-emerald-700">{currency(totals.prima)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
