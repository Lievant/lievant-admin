'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import type { ErrorKind, VacationMasterRow } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { SearchIcon, TableIcon } from '@/components/icons';
import { avatarColor, initials } from '@/lib/avatar';
import { cn } from '@/lib/utils';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function seniorityLabel(row: VacationMasterRow): string {
  const a = row.yearsOfService;
  const m = row.monthsOfService;
  const partes = [`${a} año${a === 1 ? '' : 's'}`];
  if (m > 0) partes.push(`${m} mes${m === 1 ? '' : 'es'}`);
  return partes.join(' ');
}

const VENTANA_OPCIONES = [
  { value: '', label: 'Todos' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Este trimestre' },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 border-l-4 border-l-black bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function EmployeeCell({ row }: { row: VacationMasterRow }) {
  const [imgSrc, setImgSrc] = useState<string | null>(row.photoUrl);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: avatarColor(row.fullName) }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={row.fullName}
            className="h-full w-full rounded-full object-cover"
            onError={() => setImgSrc(null)}
          />
        ) : (
          initials(row.fullName)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-navy">{row.fullName}</p>
        <p className="truncate text-xs text-slate-400">{row.area ?? '—'}</p>
      </div>
    </div>
  );
}

/** Badge de cercanía del aniversario: rojo si cae esta semana, ámbar si este mes. */
function AnniversaryBadge({ days }: { days: number }) {
  if (days < 0) return null;
  if (days <= 7) {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        Esta semana
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        Este mes
      </span>
    );
  }
  return null;
}

interface Props {
  rows: VacationMasterRow[];
  errorKind: ErrorKind | null;
  search: string;
  anniversaryWithin: string;
}

export function VacationMasterReportScreen({ rows, errorKind, search, anniversaryWithin }: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce de 300 ms para no navegar en cada tecla.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== search) navigate({ search: searchInput || null });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function navigate(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (anniversaryWithin) sp.set('anniversary_within', anniversaryWithin);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(`/rrhh/reportes/maestro-vacaciones${qs ? `?${qs}` : ''}`);
  }

  const totales = rows.reduce(
    (acc, r) => {
      acc.disponibles += r.remainingDays;
      acc.tomados += r.takenDays;
      if (r.daysUntilAnniversary >= 0 && r.daysUntilAnniversary <= 30) acc.aniversarioMes += 1;
      return acc;
    },
    { disponibles: 0, tomados: 0, aniversarioMes: 0 },
  );

  function exportExcel() {
    const data = rows.map((r) => ({
      Folio: r.displayId,
      Empleado: r.fullName,
      Área: r.area ?? '',
      'Fecha de antigüedad': r.seniorityDate.slice(0, 10),
      Antigüedad: seniorityLabel(r),
      Período: r.periodLabel,
      'Próximo aniversario': r.anniversaryDate,
      'Días hasta aniversario': r.daysUntilAnniversary,
      'Días que le tocan': r.entitledDays,
      Disponibles: r.availableDays,
      Solicitados: r.requestedDays,
      Tomados: r.takenDays,
      Restantes: r.remainingDays,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maestro vacaciones');
    const hoy = new Date();
    const stamp = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `maestro-vacaciones-${stamp}.xlsx`);
  }

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH · Reportes</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Maestro de Vacaciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Saldos, antigüedad y próximos aniversarios de los colaboradores con período vigente
          </p>
        </div>
        <Link
          href="/rrhh/reportes"
          className="shrink-0 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          ← Reportes
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API. Inicia sesión para ver datos en vivo.
        </div>
      )}

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Con período vigente" value={String(rows.length)} hint="colaboradores" />
        <StatCard
          label="Días disponibles"
          value={String(Number(totales.disponibles.toFixed(2)))}
          hint="suma de restantes"
        />
        <StatCard label="Días tomados" value={String(Number(totales.tomados.toFixed(2)))} hint="aprobados" />
        <StatCard label="Aniversario este mes" value={String(totales.aniversarioMes)} hint="próximos 30 días" />
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o folio…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-500">
          Próximo aniversario
          <select
            value={anniversaryWithin}
            onChange={(e) => navigate({ anniversary_within: e.target.value || null })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none"
          >
            {VENTANA_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={exportExcel}
          disabled={rows.length === 0}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          <TableIcon className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Antigüedad</th>
                <th className="px-4 py-3">Próx. aniversario</th>
                <th className="px-4 py-3 text-center">Días que le tocan</th>
                <th className="px-4 py-3 text-center">Disponibles</th>
                <th className="px-4 py-3 text-center">Solicitados</th>
                <th className="px-4 py-3 text-center">Tomados</th>
                <th className="px-4 py-3 text-center">Restantes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay colaboradores que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <EmployeeCell row={r} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {seniorityLabel(r)}
                      <span className="block text-xs text-slate-400">{r.periodLabel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-700">{formatDate(r.anniversaryDate)}</span>
                        <AnniversaryBadge days={r.daysUntilAnniversary} />
                      </div>
                      <span className="block text-xs text-slate-400">
                        {r.daysUntilAnniversary >= 0 ? `en ${r.daysUntilAnniversary} días` : 'vencido'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-navy">{r.entitledDays}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.availableDays}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.requestedDays}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.takenDays}</td>
                    <td
                      className={cn(
                        'px-4 py-3 text-center font-semibold',
                        r.remainingDays <= 0 ? 'text-rose-600' : 'text-navy',
                      )}
                    >
                      {r.remainingDays}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rrhh/empleados/${r.employeeId}?tab=vacaciones`}
                        className="whitespace-nowrap text-xs font-medium text-black hover:underline"
                      >
                        Ver expediente
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}
