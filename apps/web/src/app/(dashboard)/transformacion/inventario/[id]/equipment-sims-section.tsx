'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SimCard } from '@/lib/api';
import { SIM_STATUS_LABEL, SIM_STATUS_STYLE, formatPhone } from '../../sim-cards/constants';
import { useSimPermissions } from '../../sim-cards/use-sim-permissions';

interface Props {
  equipmentId: string;
  /** Nombre del empleado asignado al equipo; null si el equipo no tiene. */
  employeeName: string | null;
}

/**
 * Líneas telefónicas asociadas (pestaña Asignación del equipo). Es solo
 * informativa: no asocia, quita ni edita nada; las asignaciones se hacen en
 * Líneas Telefónicas. Muestra las líneas ligadas a este equipo y, si tiene
 * empleado, todas las de esa persona (aunque estén en otro equipo o sin equipo).
 * Se oculta sin permiso de lectura de líneas.
 */
export function EquipmentSimsSection({ equipmentId, employeeName }: Props) {
  const { canRead } = useSimPermissions();
  const [sims, setSims] = useState<SimCard[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setSims(null);
    setError(null);
    fetch(`/api/sim-cards/for-equipment/${equipmentId}`)
      .then(async (res) => {
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          return null;
        }
        if (!res.ok) throw new Error('No se pudieron cargar las líneas.');
        return (await res.json()) as SimCard[];
      })
      .then((data) => {
        if (!cancelled && data) setSims(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las líneas.');
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, equipmentId]);

  if (!canRead || forbidden) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700">Líneas telefónicas asociadas</h3>

      {error ? (
        <p className="mt-3 text-sm text-slate-500">{error}</p>
      ) : sims === null ? (
        <p className="mt-3 text-sm text-slate-400">Cargando…</p>
      ) : sims.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          {employeeName ? 'Este colaborador no tiene líneas telefónicas asignadas.' : 'Este equipo no tiene líneas asociadas.'}
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">ID Línea</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Proveedor / Plan</th>
                <th className="px-4 py-3">Equipo asociado</th>
                <th className="px-4 py-3">Estatus</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sims.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.simCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-navy">{formatPhone(s.phoneNumber)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-navy">{s.provider?.name ?? '—'}</span>
                    <span className="ml-1 text-slate-500">{s.plan.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.equipment ? (
                      s.equipment.id === equipmentId ? (
                        <span className="text-slate-700">Este equipo</span>
                      ) : (
                        <Link
                          href={`/transformacion/inventario/${s.equipment.id}`}
                          className="font-mono text-xs font-semibold text-black hover:underline"
                        >
                          {s.equipment.displayId}
                        </Link>
                      )
                    ) : (
                      <span className="text-slate-400">Sin equipo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIM_STATUS_STYLE[s.status]}`}>
                      {SIM_STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {/* Busca por código: la pantalla de líneas no tiene página propia por línea. */}
                    <Link
                      href={`/transformacion/sim-cards?search=${encodeURIComponent(s.simCode)}`}
                      className="text-xs font-medium text-black hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
