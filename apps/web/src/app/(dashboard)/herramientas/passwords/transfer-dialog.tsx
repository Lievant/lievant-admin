'use client';

import { useEffect, useRef, useState } from 'react';
import type { AccountPasswordItem, PasswordTransferCandidate } from '@/lib/api';
import { AlertIcon } from '@/components/icons';
import {
  buildTransferPayload,
  TRANSFER_REASON_MAX,
  TRANSFER_WARNING,
  transferConfirmLabel,
  validateTransferForm,
} from './transfer-form';

const fieldClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message || fallback;
}

interface TransferDialogProps {
  account: AccountPasswordItem;
  onClose: () => void;
  /** Se llama con el nombre del destino cuando el API confirmó la transferencia. */
  onTransferred: (targetName: string) => void;
}

/**
 * Transfiere la cuenta a otro colaborador activo. Lo puede hacer el dueño, su
 * jefe directo actual o SUPER_ADMIN (el API lo valida). La contraseña no se toca.
 */
export function TransferDialog({ account, onClose, onTransferred }: TransferDialogProps) {
  const [target, setTarget] = useState<PasswordTransferCandidate | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const form = { ownerId: account.employee.id, toEmployeeId: target?.id ?? '', reason };
    const problem = validateTransferForm(form);
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/passwords/${encodeURIComponent(account.id)}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTransferPayload(form)),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setError(errorMessage(body, 'No se pudo transferir la cuenta.'));
        return;
      }
      onTransferred(target!.fullName);
    } catch {
      setError('No se pudo transferir la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-navy">Transferir cuenta</h3>
        <p className="mt-1 text-sm text-slate-600">
          {account.application.name} · {account.username}
          <br />
          Dueño actual: <span className="font-medium text-navy">{account.employee.fullName}</span>
        </p>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="tr-target">
              Transferir a
            </label>
            <TransferTargetPicker
              id="tr-target"
              excludeId={account.employee.id}
              value={target}
              onChange={(t) => {
                setTarget(t);
                setError(null);
              }}
              disabled={saving}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="tr-reason">
              Motivo (opcional)
            </label>
            <textarea
              id="tr-reason"
              rows={2}
              maxLength={TRANSFER_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Cambio de área, baja del colaborador…"
              className={fieldClass}
              disabled={saving}
            />
            <p className="text-right text-xs text-slate-400">
              {reason.length}/{TRANSFER_REASON_MAX}
            </p>
          </div>

          <p className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{TRANSFER_WARNING}</span>
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={saving || !target}
            className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? 'Transfiriendo…' : transferConfirmLabel(target?.fullName ?? null)}
          </button>
        </div>
      </div>
    </div>
  );
}

const MIN_CHARS = 2;
const WAIT_MS = 300;

/**
 * Buscador de colaboradores activos, con el mismo comportamiento que el de
 * «Reporta a» en la Matriz de Puestos (mínimo 2 letras, espera breve, solo
 * cuenta la última respuesta), pero contra /api/passwords/transfer-candidates,
 * que no exige permisos de RR. HH.
 */
function TransferTargetPicker({
  id,
  excludeId,
  value,
  onChange,
  disabled,
}: {
  id: string;
  excludeId: string;
  value: PasswordTransferCandidate | null;
  onChange: (v: PasswordTransferCandidate | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PasswordTransferCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    const ticket = ++latest.current;
    if (text.length < MIN_CHARS) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/passwords/transfer-candidates?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const rows = (await res.json()) as PasswordTransferCandidate[];
        if (ticket !== latest.current) return;
        // El dueño actual no es un destino válido.
        setHits(Array.isArray(rows) ? rows.filter((r) => r.id !== excludeId) : []);
        setFailed(false);
        setOpen(true);
      } catch {
        if (ticket === latest.current) {
          setHits([]);
          setFailed(true);
          setOpen(true);
        }
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, WAIT_MS);
    return () => clearTimeout(t);
  }, [query, excludeId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy">
        <span id={id} className="min-w-0 truncate">
          {value.fullName}
          <span className="text-xs text-slate-500"> · {[value.position, value.area].filter(Boolean).join(' · ')}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder="Escribe el nombre del colaborador…"
        className={fieldClass}
        disabled={disabled}
      />
      {query.trim().length > 0 && query.trim().length < MIN_CHARS && (
        <p className="mt-1 text-xs text-slate-400">Escribe al menos {MIN_CHARS} letras.</p>
      )}
      {loading && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}
      {open && !loading && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {failed ? (
            <li className="px-3 py-2 text-xs text-red-600">No se pudo buscar. Intenta de nuevo.</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Sin coincidencias</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(h);
                    setQuery('');
                    setHits([]);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-navy">{h.fullName}</span>
                  <span className="block text-xs text-slate-500">{[h.position, h.area].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
