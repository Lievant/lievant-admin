'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ErrorKind, MediaAuditEntry, MediaPlatform } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { CheckIcon, CloseIcon, RobotIcon } from '@/components/icons';
import { useCurrentUser } from '@/components/user-provider';
import { AUDIT_ACTION_LABELS, formatDateTime } from '../constants';
import { triggerMediaSyncAction } from './actions';

interface Props {
  platforms: MediaPlatform[];
  auditLog: MediaAuditEntry[];
  errorKind: ErrorKind | null;
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Fase 1 · MVP',
  2: 'Fase 2 · Secundaria',
  3: 'Fase 3 · Terciaria',
};

export function MediaConfigScreen({ platforms, auditLog, errorKind }: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function triggerSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await triggerMediaSyncAction();
      if (res.success) {
        setMessage({ ok: true, text: `Sincronización lanzada (${res.synced ?? 0} cuentas).` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error ?? 'Error al lanzar la sincronización.' });
      }
    });
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Medios</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Configuración</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plataformas, sincronización y bitácora de acciones.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={triggerSync}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
          >
            <RobotIcon className="h-4 w-4" />
            {isPending ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        )}
      </header>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Plataformas */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Plataformas publicitarias</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: p.color ?? '#94a3b8' }}
                  />
                  {p.name}
                </span>
                {p.isActive ? (
                  <CheckIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CloseIcon className="h-4 w-4 text-slate-300" />
                )}
              </div>
              <p className="text-xs text-slate-400">{PHASE_LABELS[p.phase] ?? `Fase ${p.phase}`}</p>
              <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <dt>Latencia</dt>
                  <dd>{p.dataLatencyHours} h</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Pausa vía API</dt>
                  <dd>{p.supportsPause ? 'Sí' : 'No'}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* Bitácora */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Bitácora de acciones</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-center">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      Sin registros en la bitácora.
                    </td>
                  </tr>
                ) : (
                  auditLog.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(l.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-navy">
                        {AUDIT_ACTION_LABELS[l.actionType] ?? l.actionType}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {l.success === false ? (
                          <span className="text-red-500" title={l.errorMessage ?? ''}>
                            Error
                          </span>
                        ) : l.success === true ? (
                          <span className="text-emerald-500">OK</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </section>
    </div>
  );
}
