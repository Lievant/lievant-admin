'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SimCard, SimCardHistoryEntry } from '@/lib/api';
import {
  SIM_EXPIRY_LABEL,
  SIM_EXPIRY_STYLE,
  SIM_STATUS_LABEL,
  SIM_STATUS_STYLE,
  formatDay,
  formatMoney,
  formatPhone,
} from './constants';
import { useSimPermissions } from './use-sim-permissions';

interface EmployeeSimCardsProps {
  employeeId: string;
  title?: string;
  emptyText?: string;
  /** Columnas de valor del plan y estado. */
  showCost?: boolean;
  showStatus?: boolean;
  /** El equipo asociado enlaza a su ficha. */
  linkEquipment?: boolean;
  /** Historial plegable debajo de la tabla. */
  showHistory?: boolean;
  /**
   * La sección desaparece si el usuario no puede leer líneas (sin permiso en su
   * sesión o 403 del API). Sin esto se muestra un mensaje.
   */
  hideWhenForbidden?: boolean;
}

interface ByEmployee {
  current: SimCard[];
  history: SimCardHistoryEntry[];
}

/**
 * Líneas telefónicas de un colaborador, solo lectura. Va contra
 * /sim-cards/by-employee, que acepta `sim-cards.read` o `rrhh.empleados.read` y
 * nunca devuelve el ICCID a quien no puede escribir líneas. Lo comparten el
 * expediente de RRHH y la vista de Colaboradores y Responsivas.
 */
export function EmployeeSimCards({
  employeeId,
  title = 'Líneas telefónicas vigentes',
  emptyText = 'Sin líneas telefónicas asignadas.',
  showCost = true,
  showStatus = true,
  linkEquipment = false,
  showHistory = true,
  hideWhenForbidden = false,
}: EmployeeSimCardsProps) {
  const { canRead } = useSimPermissions();
  const [data, setData] = useState<ByEmployee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const blocked = hideWhenForbidden && !canRead;

  useEffect(() => {
    if (blocked) return;
    let cancelled = false;
    fetch(`/api/sim-cards/by-employee/${employeeId}`)
      .then(async (res) => {
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          throw new Error('No tienes permisos para ver las líneas.');
        }
        if (!res.ok) throw new Error('No se pudieron cargar las líneas.');
        return (await res.json()) as ByEmployee;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las líneas.');
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, blocked]);

  if (blocked || (hideWhenForbidden && forbidden)) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">
          {title}
          {data && data.current.length > 0 ? ` (${data.current.length})` : ''}
        </h3>
        {error ? (
          <p className="mt-3 text-sm text-slate-500">{error}</p>
        ) : data === null ? (
          <p className="mt-3 text-sm text-slate-400">Cargando…</p>
        ) : data.current.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{emptyText}</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Plan</th>
                  {showCost && <th className="px-4 py-3">Valor del plan</th>}
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Asignada desde</th>
                  {showStatus && <th className="px-4 py-3">Estado</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.current.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-black">{s.simCode}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-navy">{formatPhone(s.phoneNumber)}</td>
                    <td className="px-4 py-3 text-slate-700">{s.provider?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.plan.name}</td>
                    {showCost && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(s.monthlyCost, s.currency)}</td>
                    )}
                    <td className="px-4 py-3">
                      {s.contractEndDate ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-slate-700">{formatDay(s.contractEndDate)}</span>
                          {s.status !== 'cancelada' && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SIM_EXPIRY_STYLE[s.expiryStatus]}`}>
                              {SIM_EXPIRY_LABEL[s.expiryStatus]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {s.equipment ? (
                        linkEquipment ? (
                          <Link href={`/transformacion/inventario/${s.equipment.id}`} className="font-medium text-black hover:underline">
                            {s.equipment.displayId}
                          </Link>
                        ) : (
                          s.equipment.displayId
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDay(s.assignedDate)}</td>
                    {showStatus && (
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIM_STATUS_STYLE[s.status]}`}>
                          {SIM_STATUS_LABEL[s.status]}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showHistory && data && data.history.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Historial de líneas ({data.history.length})
          </summary>
          <ul className="mt-4 space-y-3">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    h.action === 'asignacion' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {h.action === 'asignacion' ? 'Asignada' : 'Desasignada'}
                </span>
                <div>
                  <p className="text-slate-700">
                    <span className="font-mono text-xs">{h.simCode}</span> · {formatPhone(h.phoneNumber)}
                    {h.equipment ? ` · ${h.equipment.displayId}` : ''}
                  </p>
                  {h.notes && <p className="text-xs text-slate-500">{h.notes}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {h.action === 'asignacion' ? `Desde ${formatDay(h.assignedDate)}` : `Hasta ${formatDay(h.returnedDate)}`}
                    {h.changedByName ? ` · ${h.changedByName}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
