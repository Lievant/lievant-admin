'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons';

interface Candidate {
  id: string;
  name: string;
  email: string;
}

/**
 * Vincula el expediente con el usuario de acceso que tiene exactamente el mismo
 * correo corporativo. No hay búsqueda libre: el API solo propone coincidencias
 * exactas, activas y sin otro expediente, y revalida todo al confirmar.
 */
export function LinkUserDialog({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/employees/${employeeId}/link-user-candidates`)
      .then((res) => (res.ok ? (res.json() as Promise<Candidate[]>) : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setCandidates(data);
        if (data.length === 1) setSelected(data[0]!);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/link-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authUserId: selected.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        throw new Error(message || 'No se pudo vincular el usuario.');
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular el usuario.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-navy">Vincular Usuario</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          {loadError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">No se pudieron cargar los usuarios.</p>
          ) : candidates === null ? (
            <p className="text-slate-400">Cargando…</p>
          ) : candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-slate-500">
              No Hay Un Usuario Con El Mismo Correo
            </p>
          ) : (
            <>
              <p className="text-slate-500">Usuarios con el mismo correo corporativo del expediente:</p>
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 has-[:checked]:border-black">
                      <input type="radio" name="candidate" checked={selected?.id === c.id} onChange={() => setSelected(c)} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-navy">{c.name}</span>
                        <span className="block truncate font-mono text-xs text-slate-500">{c.email}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {selected && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                  Vincular a <strong>{selected.name}</strong> con el expediente de <strong>{employeeName}</strong>
                </p>
              )}
            </>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Cancelar
          </button>
          {candidates && candidates.length > 0 && (
            <button
              type="button"
              onClick={confirm}
              disabled={!selected || saving}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Vinculando…' : 'Confirmar Vínculo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
