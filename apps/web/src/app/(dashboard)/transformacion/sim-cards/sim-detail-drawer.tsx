'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SimCardDetail } from '@/lib/api';
import {
  SIM_DEVICE_LABEL,
  SIM_EXPIRY_LABEL,
  SIM_EXPIRY_STYLE,
  SIM_STATUS_LABEL,
  SIM_STATUS_STYLE,
  errorMessageOf,
  formatDay,
  formatMoney,
  formatPhone,
  formatTerm,
} from './constants';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy">{children}</dd>
    </div>
  );
}

export function SimDetailDrawer({ simId, onClose }: { simId: string; onClose: () => void }) {
  const [sim, setSim] = useState<SimCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSim(null);
    setError(null);
    fetch(`/api/sim-cards/${simId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo cargar la línea.'));
        return (await res.json()) as SimCardDetail;
      })
      .then((data) => {
        if (!cancelled) setSim(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la línea.');
      });
    return () => {
      cancelled = true;
    };
  }, [simId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Detalle de la línea"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy">{sim ? sim.simCode : 'Línea'}</h2>
            {sim && <p className="font-mono text-sm text-slate-500">{formatPhone(sim.phoneNumber)}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && <div className="mt-4 rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}
        {!sim && !error && <p className="mt-6 text-sm text-slate-400">Cargando…</p>}

        {sim && (
          <>
            {sim.warnings.map((w) => (
              <div key={w} className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {w}
              </div>
            ))}

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Estado">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIM_STATUS_STYLE[sim.status]}`}>
                  {SIM_STATUS_LABEL[sim.status]}
                </span>
              </Field>
              <Field label="Dispositivo">{SIM_DEVICE_LABEL[sim.deviceType]}</Field>
              <Field label="Proveedor">{sim.provider?.name ?? '—'}</Field>
              <Field label="Plan">{sim.plan.name}</Field>
              <Field label="Valor del plan">
                {formatMoney(sim.monthlyCost, sim.currency)}
                {sim.ownMonthlyCost !== null && <span className="ml-1 text-xs text-slate-400">(costo propio)</span>}
              </Field>
              <Field label="Plazo">{formatTerm(sim.termMonths)}</Field>
              <Field label="Activación">{formatDay(sim.activationDate)}</Field>
              <Field label="Vencimiento">
                {formatDay(sim.contractEndDate)}
                {sim.contractEndDate && sim.status !== 'cancelada' && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${SIM_EXPIRY_STYLE[sim.expiryStatus]}`}>
                    {SIM_EXPIRY_LABEL[sim.expiryStatus]}
                  </span>
                )}
              </Field>
              {sim.iccid !== undefined && <Field label="ICCID"><span className="font-mono text-xs">{sim.iccid ?? '—'}</span></Field>}
              <Field label="Asignado a">
                {sim.employee ? (
                  <Link href={`/transformacion/inventario/colaboradores/${sim.employee.id}`} className="hover:underline">
                    {sim.employee.fullName}
                  </Link>
                ) : (
                  <span className="text-slate-400">Sin asignar</span>
                )}
              </Field>
              <Field label="Fecha de asignación">{formatDay(sim.assignedDate)}</Field>
              <Field label="Equipo">
                {sim.equipment ? (
                  <Link href={`/transformacion/inventario/${sim.equipment.id}`} className="hover:underline">
                    <span className="font-mono text-xs">{sim.equipment.displayId}</span> {sim.equipment.label}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
            </dl>

            {sim.notes && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{sim.notes}</p>
              </div>
            )}

            <h3 className="mt-8 text-sm font-semibold text-slate-700">Historial de asignaciones</h3>
            {sim.history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Esta línea aún no tiene movimientos.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {sim.history.map((h) => (
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
                        {h.employee ? h.employee.fullName : 'Sin persona'}
                        {h.equipment ? ` · ${h.equipment.displayId}` : ''}
                      </p>
                      {h.notes && <p className="text-xs text-slate-500">{h.notes}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">
                        {h.action === 'asignacion' ? `Desde ${formatDay(h.assignedDate)}` : `Hasta ${formatDay(h.returnedDate)}`} ·{' '}
                        {h.changedByName ?? '—'} ·{' '}
                        {new Date(h.createdAt).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
