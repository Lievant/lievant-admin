'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, SearchIcon, TrashIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { useCurrentUser } from '@/components/user-provider';
import type {
  AssignerRecord,
  AssignmentRecord,
  AssignmentsPage,
  AssignmentStats,
  ErrorKind,
  ToolRecord,
} from '@/lib/api';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import {
  addAssignerAction,
  removeAssignerAction,
  revokeAssignmentAction,
  updateLastUsedAction,
} from './actions';
import { formatDate, STATUS_LABEL, STATUS_STYLE, todayISO, unusedTone } from './constants';
import { NewAssignmentDialog } from './new-assignment-dialog';

type TabKey = 'resumen' | 'asignaciones' | 'configuracion';

interface Filters {
  search: string;
  status: string;
  toolId: string;
  area: string;
}

interface AssignmentsScreenProps {
  page: AssignmentsPage;
  stats: AssignmentStats;
  tools: ToolRecord[];
  assigners: AssignerRecord[];
  areas: string[];
  filters: Filters;
  tab: TabKey;
  errorKind: ErrorKind | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'asignaciones', label: 'Asignaciones' },
  { key: 'configuracion', label: 'Configuración' },
];

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? 'text-navy'}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AssignmentRecord['status'] }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function UnusedBadge({ dias }: { dias: number | null }) {
  const { style, label } = unusedTone(dias);
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

export function AssignmentsScreen({
  page,
  stats,
  tools,
  assigners,
  areas,
  filters,
  tab,
  errorKind,
}: AssignmentsScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();

  const [search, setSearch] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [revoking, setRevoking] = useState<AssignmentRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  // El último uso salió del grid: no hay forma de alimentarlo automáticamente
  // desde la plataforma, así que vive en el detalle y se captura a mano.
  const [detail, setDetail] = useState<AssignmentRecord | null>(null);
  const [detailLastUsed, setDetailLastUsed] = useState('');
  const [newAssigner, setNewAssigner] = useState<EmployeePickerValue | null>(null);

  const isSuperAdmin = !user || user.roles.some((r) => r.name === 'SUPER_ADMIN');
  // Sin usuario resuelto se asume que puede: mismo criterio que el sidebar, para
  // que un fallo de /auth/me no esconda el botón en vez de fallar al guardar.
  const canWrite =
    !user ||
    isSuperAdmin ||
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'asignaciones' && p.action === 'write',
    );

  if (errorKind === 'forbidden') return <NoPermissions />;

  function pushParams(next: Partial<Filters & { tab: TabKey }>) {
    const params = new URLSearchParams();
    const merged = { ...filters, tab, ...next };
    if (merged.tab && merged.tab !== 'resumen') params.set('tab', merged.tab);
    if (merged.search) params.set('search', merged.search);
    if (merged.status) params.set('status', merged.status);
    if (merged.toolId) params.set('toolId', merged.toolId);
    if (merged.area) params.set('area', merged.area);
    const qs = params.toString();
    router.push(`/transformacion/asignaciones${qs ? `?${qs}` : ''}`);
  }

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? 'No se pudo completar la operación.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleRevokeConfirm() {
    if (!revoking) return;
    const ok = await run(`revoke-${revoking.id}`, () =>
      revokeAssignmentAction(revoking.id, revokeReason.trim() || undefined),
    );
    if (ok) {
      setRevoking(null);
      setRevokeReason('');
    }
  }

  async function handleSaveLastUsed() {
    if (!detail || !detailLastUsed) return;
    const ok = await run(`lastused-${detail.id}`, () =>
      updateLastUsedAction(detail.id, detailLastUsed),
    );
    if (ok) setDetail(null);
  }

  async function handleAddAssigner() {
    if (!newAssigner) return;
    // El catálogo referencia auth.users; el picker devuelve el expediente, así
    // que se manda el employeeId y el API resuelve el usuario por correo.
    const ok = await run('add-assigner', () =>
      addAssignerAction({ employeeId: newAssigner.id, displayName: newAssigner.fullName }),
    );
    if (ok) setNewAssigner(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Asignaciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Qué herramienta tiene cada colaborador, desde cuándo y cuándo la usó por última vez.
          </p>
        </div>
        {canWrite && tab === 'asignaciones' && (
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva asignación
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          if (t.key === 'configuracion' && !canWrite) return null;
          return (
            <button
              key={t.key}
              onClick={() => pushParams({ tab: t.key })}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'border-navy text-navy'
                  : 'border-transparent text-slate-500 hover:text-navy'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* ── TAB 1 · Resumen ────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Asignaciones activas" value={String(stats.totalActive)} />
            <StatCard
              label="Sin uso +60 días"
              value={String(stats.unusedOver60Days)}
              tone={stats.unusedOver60Days > 0 ? 'text-red-600' : undefined}
            />
            <StatCard label="Revocadas" value={String(stats.totalRevoked)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Por herramienta
              </h2>
              <ScrollableTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Herramienta</th>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3 text-right">Activas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.byTool.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                          Todavía no hay asignaciones activas.
                        </td>
                      </tr>
                    )}
                    {stats.byTool.map((row) => (
                      <tr key={row.toolCode} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-navy">{row.toolName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">
                          {row.toolCode}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {row.activeCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Por área
              </h2>
              <ScrollableTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Área</th>
                      <th className="px-4 py-3 text-right">Asignaciones activas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.byArea.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                          Todavía no hay asignaciones activas.
                        </td>
                      </tr>
                    )}
                    {stats.byArea.map((row) => (
                      <tr key={row.area} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-navy">{row.area}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {row.activeCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Últimas asignaciones
            </h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {stats.recentAssignments.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Todavía no hay asignaciones.
                </p>
              )}
              {stats.recentAssignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-slate-400">{a.assignmentCode}</span>
                  <span className="text-slate-500">{formatDate(a.assignmentDate)}</span>
                  <span className="font-medium text-navy">{a.employee.fullName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-navy">{a.tool.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2 · Asignaciones ───────────────────────────────────────── */}
      {tab === 'asignaciones' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pushParams({ search });
                }}
                placeholder="Buscar por colaborador, herramienta o folio…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => pushParams({ status: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="revocado">Revocado</option>
            </select>

            <select
              value={filters.toolId}
              onChange={(e) => pushParams({ toolId: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todas las herramientas</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filters.area}
              onChange={(e) => pushParams({ area: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Herramienta</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Asignado por</th>
                  <th className="px-4 py-3">Fecha asignación</th>
                  <th className="px-4 py-3">Estado</th>
                  {canWrite && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={canWrite ? 8 : 7}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No hay asignaciones que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {page.data.map((a) => (
                  <tr key={a.id} className={a.status === 'revocado' ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {a.assignmentCode}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{a.tool.name}</p>
                      <p className="font-mono text-xs text-slate-400">{a.tool.toolCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{a.employee.fullName}</p>
                      {a.employee.position && (
                        <p className="text-xs text-slate-400">{a.employee.position}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.employee.area ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.assignedByName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(a.assignmentDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setDetail(a);
                            setDetailLastUsed(a.lastUsedDate ?? '');
                          }}
                          className="mr-2 rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-slate-100"
                        >
                          Detalle
                        </button>
                        {a.status === 'activo' && (
                          <button
                            onClick={() => {
                              setRevoking(a);
                              setRevokeReason('');
                            }}
                            className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>

          {page.nextCursor && (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('cursor', page.nextCursor as string);
                  router.push(`/transformacion/asignaciones?${params.toString()}`);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
              >
                Cargar más
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3 · Configuración ──────────────────────────────────────── */}
      {tab === 'configuracion' && canWrite && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Personas autorizadas para asignar
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              El campo &quot;Asignado por&quot; solo acepta nombres de esta lista, para que el
              histórico sea auditable.
            </p>

            <ul className="mt-4 divide-y divide-slate-100">
              {assigners.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400">
                  No hay asignadores configurados.
                </li>
              )}
              {assigners.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-navy">{a.displayName}</span>
                  <button
                    onClick={() => {
                      if (!confirm(`¿Quitar a ${a.displayName} de la lista de asignadores?`)) return;
                      void run(`remove-${a.id}`, () => removeAssignerAction(a.id));
                    }}
                    disabled={busy === `remove-${a.id}`}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Quitar a ${a.displayName}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <EmployeePicker
                label="Agregar asignador"
                value={newAssigner}
                onSelect={setNewAssigner}
              />
              <button
                onClick={handleAddAssigner}
                disabled={!newAssigner || busy === 'add-assigner'}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar asignador
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogOpen && (
        <NewAssignmentDialog
          tools={tools}
          assigners={assigners}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <p className="font-mono text-xs text-slate-400">{detail.assignmentCode}</p>
            <h2 className="text-lg font-bold text-navy">{detail.tool.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {detail.employee.fullName}
              {detail.employee.area ? ` · ${detail.employee.area}` : ''}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </dt>
                <dd className="mt-0.5">
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Asignado por
                </dt>
                <dd className="mt-0.5 text-navy">{detail.assignedByName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fecha de asignación
                </dt>
                <dd className="mt-0.5 text-navy">{formatDate(detail.assignmentDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Días sin uso
                </dt>
                <dd className="mt-0.5">
                  {detail.status === 'activo' ? <UnusedBadge dias={detail.diasSinUso} /> : '—'}
                </dd>
              </div>
              {detail.revocationDate && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Revocada el {formatDate(detail.revocationDate)}
                  </dt>
                  <dd className="mt-0.5 text-navy">{detail.revocationReason ?? 'Sin motivo'}</dd>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notas
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-navy">{detail.notes}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Último uso conocido
              </label>
              <p className="mb-2 text-xs text-slate-400">
                Se captura a mano: la plataforma no puede leerlo de las herramientas.
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={detailLastUsed}
                  max={todayISO()}
                  onChange={(e) => setDetailLastUsed(e.target.value)}
                  disabled={!canWrite}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy disabled:bg-slate-50"
                />
                {canWrite && (
                  <button
                    onClick={handleSaveLastUsed}
                    disabled={!detailLastUsed || busy === `lastused-${detail.id}`}
                    className="whitespace-nowrap rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === `lastused-${detail.id}` ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDetail(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {revoking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">Revocar asignación</h2>
            <p className="mt-1 text-sm text-slate-500">
              {revoking.assignmentCode} — {revoking.tool.name} de {revoking.employee.fullName}
            </p>
            <label className="mt-4 mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Motivo (queda en la bitácora de auditoría)
            </label>
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Baja del colaborador, cambio de plan, sin uso…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRevoking(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={busy === `revoke-${revoking.id}`}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === `revoke-${revoking.id}` ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
