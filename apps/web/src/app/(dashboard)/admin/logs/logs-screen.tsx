'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { useCurrentUser } from '@/components/user-provider';
import type {
  AuditModuleConfigRow,
  ErrorKind,
  PlatformErrorRow,
  SecurityEventRow,
  UserActivityRow,
} from '@/lib/api';

type TabKey = 'seguridad' | 'actividad' | 'errores' | 'configuracion';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'seguridad', label: 'Seguridad' },
  { key: 'actividad', label: 'Actividad' },
  { key: 'errores', label: 'Errores' },
  { key: 'configuracion', label: 'Configuración' },
];

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const INPUT =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy';

/** Rango por defecto: últimos 7 días. */
function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 6 * 86_400_000);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(from), to: iso(to) };
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  errorKind: ErrorKind | null;
}

export function LogsScreen({ errorKind }: Props) {
  const user = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('seguridad');
  const [range, setRange] = useState(defaultRange());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [security, setSecurity] = useState<SecurityEventRow[]>([]);
  const [activity, setActivity] = useState<UserActivityRow[]>([]);
  const [errors, setErrors] = useState<PlatformErrorRow[]>([]);
  const [unresolved, setUnresolved] = useState(0);
  const [config, setConfig] = useState<AuditModuleConfigRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'admin' && p.module === 'audit' && p.action === 'write',
    );

  const load = useCallback(
    async (which: TabKey, append = false, from?: string) => {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ dateFrom: range.from, dateTo: range.to });
      if (from) qs.set('cursor', from);

      try {
        if (which === 'configuracion') {
          const res = await fetch('/api/audit/config');
          setConfig(res.ok ? ((await res.json()) as AuditModuleConfigRow[]) : []);
          setCursor(null);
          return;
        }

        const path =
          which === 'seguridad' ? 'security' : which === 'actividad' ? 'activity' : 'errors';
        const res = await fetch(`/api/audit/${path}?${qs.toString()}`);
        if (!res.ok) throw new Error('No se pudieron cargar los registros.');
        const body = (await res.json()) as {
          data: unknown[];
          nextCursor: string | null;
          unresolvedCount?: number;
        };

        if (which === 'seguridad') {
          const rows = body.data as SecurityEventRow[];
          setSecurity((prev) => (append ? [...prev, ...rows] : rows));
        } else if (which === 'actividad') {
          const rows = body.data as UserActivityRow[];
          setActivity((prev) => (append ? [...prev, ...rows] : rows));
        } else {
          const rows = body.data as PlatformErrorRow[];
          setErrors((prev) => (append ? [...prev, ...rows] : rows));
          setUnresolved(body.unresolvedCount ?? 0);
        }
        setCursor(body.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar.');
      } finally {
        setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function resolveError(id: string) {
    const res = await fetch(`/api/audit/errors/${id}/resolve`, { method: 'PATCH' });
    if (res.ok) void load('errores');
  }

  async function toggleModule(row: AuditModuleConfigRow, field: 'auditEnabled' | 'logWrites') {
    const res = await fetch(`/api/audit/config/${row.module}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !row[field] }),
    });
    if (res.ok) void load('configuracion');
  }

  // SheetJS se carga solo al exportar: son ~96 kB que no tienen por qué pesar
  // en una pantalla de consulta.
  async function exportExcel() {
    const XLSX = await import('xlsx');
    const rows: Record<string, unknown>[] =
      tab === 'seguridad'
        ? security.map((r) => ({
            Fecha: formatWhen(r.createdAt),
            Evento: r.eventType,
            Severidad: r.severity,
            Usuario: r.userEmail ?? '',
            IP: r.ipAddress ?? '',
            Módulo: r.module ?? '',
          }))
        : tab === 'actividad'
          ? activity.map((r) => ({
              Fecha: formatWhen(r.createdAt),
              Usuario: r.userName ?? r.userEmail ?? '',
              Área: r.department ?? '',
              Acción: r.action,
              Módulo: r.module,
              Registro: r.entityName ?? r.entityId ?? '',
            }))
          : errors.map((r) => ({
              Fecha: formatWhen(r.createdAt),
              Código: r.errorCode ?? '',
              Mensaje: r.message,
              Módulo: r.module ?? '',
              Endpoint: r.endpoint ?? '',
              Status: r.httpStatus ?? '',
              Resuelto: r.resolved ? 'Sí' : 'No',
            }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `logs-${tab}-${range.from}-${range.to}.xlsx`);
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Logs y Auditoría</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quién hizo qué, cuándo y desde dónde. Las escrituras se registran solas.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-navy'
            }`}
          >
            {t.label}
            {t.key === 'errores' && unresolved > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {unresolved}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab !== 'configuracion' && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Desde
            </label>
            <input
              type="date"
              className={INPUT}
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hasta
            </label>
            <input
              type="date"
              className={INPUT}
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
          <button
            onClick={() => void load(tab)}
            disabled={loading}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* ── Seguridad ─────────────────────────────────────────────────── */}
      {tab === 'seguridad' && (
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Severidad</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Módulo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {security.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Sin eventos de seguridad en el período.
                  </td>
                </tr>
              )}
              {security.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatWhen(r.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-navy">{r.eventType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        SEVERITY_STYLE[r.severity] ?? ''
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.userEmail ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {r.ipAddress ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.module ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {/* ── Actividad ─────────────────────────────────────────────────── */}
      {tab === 'actividad' && (
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Sin actividad registrada en el período.
                  </td>
                </tr>
              )}
              {activity.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatWhen(r.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-navy">
                    {r.userName ?? r.userEmail ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.department ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.action}</td>
                  <td className="px-4 py-3 text-slate-600">{r.module}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.entityName ?? r.entityId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {/* ── Errores ───────────────────────────────────────────────────── */}
      {tab === 'errores' && (
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Mensaje</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Endpoint</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Estado</th>
                {canWrite && <th className="px-4 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                    Sin errores en el período. Buena señal.
                  </td>
                </tr>
              )}
              {errors.map((r) => (
                <tr key={r.id} className={r.resolved ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 text-slate-600">{formatWhen(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{r.errorCode ?? 'Error'}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{r.message}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.module ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {r.httpMethod} {r.endpoint ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.httpStatus ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.resolved ? 'Resuelto' : 'Sin resolver'}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      {!r.resolved && (
                        <button
                          onClick={() => void resolveError(r.id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Marcar resuelto
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {/* ── Configuración ─────────────────────────────────────────────── */}
      {tab === 'configuracion' && (
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Auditoría</th>
                <th className="px-4 py-3">Escrituras</th>
                <th className="px-4 py-3 text-right">Retención (días)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {config.map((r) => (
                <tr key={r.module} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{r.displayName}</p>
                    <p className="font-mono text-xs text-slate-400">{r.module}</p>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={r.auditEnabled}
                        disabled={!canWrite}
                        onChange={() => void toggleModule(r, 'auditEnabled')}
                      />
                      <span className="text-xs text-slate-600">
                        {r.auditEnabled ? 'Activa' : 'Apagada'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={r.logWrites}
                        disabled={!canWrite || !r.auditEnabled}
                        onChange={() => void toggleModule(r, 'logWrites')}
                      />
                      <span className="text-xs text-slate-600">
                        {r.logWrites ? 'Se registran' : 'No'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {r.retentionDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {tab !== 'configuracion' && cursor && (
        <div className="flex justify-center">
          <button
            onClick={() => void load(tab, true, cursor)}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50"
          >
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
}
