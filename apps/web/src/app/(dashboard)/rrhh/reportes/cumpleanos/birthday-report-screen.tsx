'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import type { BirthdayReportItem } from '@/lib/api';
import { CakeIcon, ChevronLeftIcon, PrintIcon, TableIcon } from '@/components/icons';

interface Props {
  items: BirthdayReportItem[];
  selectedMonth: number;
  selectedOrderBy: 'date' | 'name' | 'area';
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function getDaysUntil(birthDateMMDD: string, today: Date): number {
  const [mm, dd] = birthDateMMDD.split('-').map(Number);
  const birthday = new Date(today.getFullYear(), (mm ?? 1) - 1, dd ?? 1);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((birthday.getTime() - todayMidnight.getTime()) / 86400000);
}

function DaysBadge({ days }: { days: number }) {
  if (days === 0) {
    return <span className="font-semibold text-black">Hoy 🎂</span>;
  }
  if (days === 1) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        Mañana
      </span>
    );
  }
  if (days > 1 && days <= 7) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        En {days} días
      </span>
    );
  }
  if (days > 7) {
    return <span className="text-sm text-slate-400">En {days} días</span>;
  }
  return <span className="text-sm text-slate-400">Hace {-days} días</span>;
}

export function BirthdayReportScreen({ items, selectedMonth, selectedOrderBy }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  function navigate(month: number, orderBy: string) {
    startTransition(() => {
      router.push(`/rrhh/reportes/cumpleanos?month=${month}&orderBy=${orderBy}`);
    });
  }

  const todayBirthdays = useMemo(() => {
    if (!today) return 0;
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return items.filter((i) => i.birthDate === `${mm}-${dd}`).length;
  }, [items, today]);

  function exportExcel() {
    const data = items.map((item) => ({
      Nombre: item.fullName,
      Área: item.area ?? '',
      División: item.division ?? '',
      Puesto: item.position,
      'Cumpleaños (DD/MM)': item.birthDate.split('-').reverse().join('/'),
      Empresa: item.companyName,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cumpleaños');
    XLSX.writeFile(wb, `cumpleanos_${MONTH_NAMES[selectedMonth - 1] ?? selectedMonth}.xlsx`);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      {/* Navigation header — hidden in print */}
      <div className="mb-6 print:hidden">
        <Link
          href="/rrhh/reportes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes RRHH
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
              <CakeIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH · Reportes</p>
              <h1 className="text-2xl font-bold text-navy">Cumpleaños del mes</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Print header */}
      <div className="mb-6 hidden print:block">
        <h1 className="text-2xl font-bold text-navy">
          Reporte de Cumpleaños — {MONTH_NAMES[selectedMonth - 1]}
        </h1>
        {today && (
          <p className="mt-1 text-sm text-slate-500">
            Generado el {today.toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </p>
        )}
      </div>

      {/* Filters + export actions */}
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mes</label>
          <select
            value={selectedMonth}
            onChange={(e) => navigate(Number(e.target.value), selectedOrderBy)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-50"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar por</label>
          <select
            value={selectedOrderBy}
            onChange={(e) => navigate(selectedMonth, e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-50"
          >
            <option value="date">Fecha (día del mes)</option>
            <option value="name">Nombre</option>
            <option value="area">Área</option>
          </select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            <TableIcon className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          >
            <PrintIcon className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Today's birthday banner */}
      {today && todayBirthdays > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-black/10 px-4 py-3 text-sm print:hidden">
          <span className="text-xl">🎂</span>
          <span className="font-medium text-black">
            {todayBirthdays === 1
              ? 'Hoy cumple años 1 persona del equipo'
              : `Hoy cumplen años ${todayBirthdays} personas del equipo`}
          </span>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center">
          <CakeIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-400">
            No hay empleados con cumpleaños en {MONTH_NAMES[selectedMonth - 1]}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Empleado</th>
                <th className="px-4 py-3 text-left">Área / División</th>
                <th className="px-4 py-3 text-left">Puesto</th>
                <th className="px-4 py-3 text-left">Cumpleaños</th>
                <th className="px-4 py-3 text-left">Días</th>
                <th className="px-4 py-3 text-left">Empresa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const days = today ? getDaysUntil(item.birthDate, today) : null;
                const isToday = days === 0;
                const isUpcoming = days !== null && days > 0 && days <= 7;

                const parts = item.birthDate.split('-');
                const mm = parts[0] ?? '01';
                const dd = parts[1] ?? '01';
                const friendlyDate = `${Number(dd)} de ${MONTH_NAMES[Number(mm) - 1] ?? mm}`;

                return (
                  <tr
                    key={item.id}
                    className={isToday ? 'bg-black/10' : 'hover:bg-slate-50/60'}
                  >
                    {/* Avatar + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isToday ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {getInitials(item.fullName)}
                        </span>
                        <span className="font-medium text-navy">{item.fullName}</span>
                        {isUpcoming && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Próximo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Area / Division */}
                    <td className="px-4 py-3 text-slate-600">
                      {item.area ?? '—'}
                      {item.division && (
                        <span className="ml-1 text-slate-400">· {item.division}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">{item.position}</td>
                    <td className="px-4 py-3 text-slate-700">{friendlyDate}</td>
                    <td className="px-4 py-3">
                      {days !== null ? <DaysBadge days={days} /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.companyName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-3 text-xs text-slate-400 print:hidden">
          {items.length} empleado{items.length !== 1 ? 's' : ''} con cumpleaños en{' '}
          {MONTH_NAMES[selectedMonth - 1]}
        </p>
      )}
    </div>
  );
}
