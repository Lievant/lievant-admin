'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import type { ExpiringContractItem } from '@/lib/api';
import { ChevronLeftIcon, ContractIcon, TableIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface Props {
  items: ExpiringContractItem[];
  selectedDays: number;
}

const DAYS_OPTIONS = [7, 15, 30, 60, 90];

function DaysBadge({ days }: { days: number }) {
  if (days < 7) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        {days} día{days !== 1 ? 's' : ''}
      </span>
    );
  }
  if (days < 15) {
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
        {days} días
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        {days} días
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      {days} días
    </span>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function ExpiringContractsScreen({ items, selectedDays }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(days: number) {
    startTransition(() => {
      router.push(`/rrhh/reportes/contratos?days=${days}`);
    });
  }

  function exportExcel() {
    const data = items.map((item) => ({
      ID: item.displayId,
      Nombre: item.fullName,
      Puesto: item.position,
      Área: item.area ?? '',
      División: item.division ?? '',
      Empresa: item.companyName,
      'Tipo contrato': item.contractType ?? '',
      'Fecha vencimiento': formatDate(item.contractEndDate),
      'Días restantes': item.daysUntilExpiry,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    XLSX.writeFile(wb, `contratos_por_vencer_${selectedDays}d.xlsx`);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/rrhh/reportes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes RRHH
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ContractIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH · Reportes</p>
              <h1 className="text-2xl font-bold text-navy">Contratos por vencer</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + export */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Próximos</label>
          <select
            value={selectedDays}
            onChange={(e) => navigate(Number(e.target.value))}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-50"
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button
            onClick={exportExcel}
            disabled={items.length === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <TableIcon className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center">
          <ContractIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-400">
            No hay contratos que venzan en los próximos {selectedDays} días
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Empleado</th>
                <th className="px-4 py-3 text-left">Puesto</th>
                <th className="px-4 py-3 text-left">Área / División</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Tipo contrato</th>
                <th className="px-4 py-3 text-left">Vence</th>
                <th className="px-4 py-3 text-left">Días restantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-navy">{item.fullName}</p>
                      <p className="text-xs text-slate-400">{item.displayId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.position}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[item.area, item.division].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.companyName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.contractType ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(item.contractEndDate)}</td>
                  <td className="px-4 py-3">
                    <DaysBadge days={item.daysUntilExpiry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {items.length} contrato{items.length !== 1 ? 's' : ''} vence{items.length !== 1 ? 'n' : ''} en los próximos {selectedDays} días
        </p>
      )}
    </div>
  );
}
