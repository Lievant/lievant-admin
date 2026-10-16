'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SimCard } from '@/lib/api';
import {
  SIM_EXPIRY_LABEL,
  SIM_EXPIRY_STYLE,
  SIM_STATUS_LABEL,
  SIM_STATUS_STYLE,
  errorMessageOf,
  formatDay,
  formatPhone,
} from '../../sim-cards/constants';
import { useSimPermissions } from '../../sim-cards/use-sim-permissions';

/**
 * Líneas telefónicas asociadas a un equipo (pestaña Asignación). Solo se pinta si
 * el usuario puede leer líneas; asociar y quitar requieren permiso de escritura.
 * La persona de la línea no cambia aquí: solo se enlaza o se suelta el equipo.
 */
export function EquipmentSimsSection({ equipmentId }: { equipmentId: string }) {
  const { canRead, canWrite } = useSimPermissions();
  const [sims, setSims] = useState<SimCard[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [available, setAvailable] = useState<SimCard[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sim-cards/by-equipment/${equipmentId}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudieron cargar las líneas.'));
      const data = (await res.json()) as SimCard[];
      setSims(data);
      // Los avisos de desajuste de personas se muestran siempre que existan.
      setWarnings(data.flatMap((s) => s.warnings));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las líneas.');
    }
  }, [equipmentId]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const options = useMemo(() => available ?? [], [available]);

  async function openPicker() {
    setError(null);
    setSelected('');
    setPicking(true);
    setAvailable(null);
    try {
      const res = await fetch('/api/sim-cards/without-equipment');
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudieron cargar las líneas disponibles.'));
      setAvailable((await res.json()) as SimCard[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las líneas disponibles.');
      setPicking(false);
    }
  }

  async function associate() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sim-cards/${selected}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo asociar la línea.'));
      setPicking(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asociar la línea.');
    } finally {
      setBusy(false);
    }
  }

  async function detach(sim: SimCard) {
    if (!window.confirm(`¿Quitar la línea ${sim.simCode} de este equipo?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sim-cards/${sim.id}/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'equipment' }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo quitar la línea.'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la línea.');
    } finally {
      setBusy(false);
    }
  }

  if (!canRead || forbidden) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-700">Líneas telefónicas asociadas</h3>
        {canWrite && !picking && (
          <button type="button" onClick={() => void openPicker()} className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            Asociar línea
          </button>
        )}
      </div>

      {error && <div className="mt-3 rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}
      {warnings.map((w) => (
        <div key={w} className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {w}
        </div>
      ))}

      {picking && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {available === null ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500">No hay líneas sin equipo. Registra una en «Líneas Telefónicas».</p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Línea a asociar"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
            >
              <option value="">Selecciona una línea…</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.simCode} · {formatPhone(s.phoneNumber)} · {s.plan.name}
                  {s.employee ? ` · ${s.employee.fullName}` : ''}
                </option>
              ))}
            </select>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void associate()}
              disabled={!selected || busy}
              className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Asociar'}
            </button>
            <button type="button" onClick={() => setPicking(false)} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sims === null && !error ? (
        <p className="mt-3 text-sm text-slate-400">Cargando…</p>
      ) : sims !== null && sims.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Este equipo no tiene líneas asociadas.</p>
      ) : sims !== null ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Asignada a</th>
                <th className="px-4 py-3">Estado</th>
                {canWrite && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sims.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href="/transformacion/sim-cards" className="font-mono text-xs font-semibold text-black hover:underline">
                      {s.simCode}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-navy">{formatPhone(s.phoneNumber)}</td>
                  <td className="px-4 py-3 text-slate-700">{s.plan.name}</td>
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
                  <td className="px-4 py-3 text-slate-700">{s.employee?.fullName ?? <span className="text-slate-400">Sin asignar</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIM_STATUS_STYLE[s.status]}`}>{SIM_STATUS_LABEL[s.status]}</span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => void detach(s)} disabled={busy} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
