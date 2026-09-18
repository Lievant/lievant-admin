'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { useCurrentUser } from '@/components/user-provider';
import type {
  ErrorKind,
  LicenseModuleStats,
  LicenseRecord,
  LicensesPage,
  LicenseStatus,
  ToolRecord,
} from '@/lib/api';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import { revokeLicenseAction } from './actions';
import { AssignLicenseDialog } from './assign-license-dialog';
import {
  daysUntil,
  formatDate,
  formatMoney,
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_STYLE,
} from './constants';

type TabKey = 'resumen' | 'licencias' | 'colaborador';

interface Filters {
  search: string;
  toolId: string;
  businessUnit: string;
  status: string;
  currency: string;
}

interface LicensesScreenProps {
  page: LicensesPage;
  stats: LicenseModuleStats;
  tools: ToolRecord[];
  businessUnits: string[];
  filters: Filters;
  tab: TabKey;
  errorKind: ErrorKind | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'licencias', label: 'Licencias' },
  { key: 'colaborador', label: 'Por colaborador' },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        LICENSE_STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {LICENSE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ExpiryCell({ date }: { date: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">Sin vencimiento</span>;
  const tone =
    days < 0 ? 'text-red-600 font-semibold' : days <= 30 ? 'text-amber-600 font-semibold' : 'text-navy';
  return (
    <span className={tone}>
      {formatDate(date)}
      {days < 0 && <span className="ml-1 text-xs">(vencida)</span>}
      {days >= 0 && days <= 30 && <span className="ml-1 text-xs">({days} d)</span>}
    </span>
  );
}

export function LicensesScreen({
  page,
  stats,
  tools,
  businessUnits,
  filters,
  tab,
  errorKind,
}: LicensesScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();

  const [search, setSearch] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tab 3 consulta al vuelo: el colaborador lo elige el usuario, no la URL.
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [employeeLicenses, setEmployeeLicenses] = useState<LicenseRecord[] | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);

  // Sin usuario resuelto se asume que puede: mismo criterio que el sidebar, para
  // que un fallo de /auth/me no esconda el botón en vez de fallar al guardar.
  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'licencias' && p.action === 'write',
    );

  if (errorKind === 'forbidden') return <NoPermissions />;

  function pushParams(next: Partial<Filters & { tab: TabKey; page: number }>) {
    const params = new URLSearchParams();
    const merged = { ...filters, tab, page: page.page, ...next };
    if (merged.tab && merged.tab !== 'resumen') params.set('tab', merged.tab);
    if (merged.search) params.set('search', merged.search);
    if (merged.toolId) params.set('toolId', merged.toolId);
    if (merged.businessUnit) params.set('businessUnit', merged.businessUnit);
    if (merged.status) params.set('status', merged.status);
    if (merged.currency) params.set('currency', merged.currency);
    if (merged.page && merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    router.push(`/transformacion/licencias${qs ? `?${qs}` : ''}`);
  }

  async function loadEmployeeLicenses(emp: EmployeePickerValue | null) {
    setEmployee(emp);
    setEmployeeLicenses(null);
    if (!emp) return;
    setLoadingEmployee(true);
    try {
      const res = await fetch(`/api/tool-licenses/by-employee/${emp.id}`);
      setEmployeeLicenses(res.ok ? await res.json() : []);
    } catch {
      setEmployeeLicenses([]);
    } finally {
      setLoadingEmployee(false);
    }
  }

  async function handleRevoke(license: LicenseRecord) {
    if (!confirm(`¿Revocar ${license.licenseCode} (${license.toolName})?`)) return;
    setBusy(license.id);
    setError(null);
    const result = await revokeLicenseAction(license.id);
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? 'No se pudo revocar la licencia.');
      return;
    }
    router.refresh();
    if (employee) void loadEmployeeLicenses(employee);
  }

  const employeeTotals = (employeeLicenses ?? [])
    .filter((l) => l.status === 'activa')
    .reduce(
      (acc, l) => {
        const key = l.currency ?? 'MXN';
        acc[key] = (acc[key] ?? 0) + (l.unitCost ?? 0);
        return acc;
      },
      {} as Record<string, number>,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Licencias</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registro individual de cada licencia asignada, su costo y su vencimiento.
          </p>
        </div>
        {canWrite && tab === 'licencias' && (
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Asignar licencia
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => pushParams({ tab: t.key, page: 1 })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* ── TAB 1 · Resumen ────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Licencias activas" value={String(stats.activeLicenses)} hint={`${stats.totalLicenses} en total`} />
            <StatCard label="Costo MXN" value={formatMoney(stats.totalCostMXN, 'MXN')} hint="Licencias activas" />
            <StatCard label="Costo USD" value={formatMoney(stats.totalCostUSD, 'USD')} hint="Licencias activas" />
            <StatCard label="Vencen en 30 días" value={String(stats.expiringIn30Days)} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Por herramienta
            </h2>
            <ScrollableTable>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Herramienta</th>
                    <th className="px-4 py-3 text-right">Licencias activas</th>
                    <th className="px-4 py-3 text-right">Costo total</th>
                    <th className="px-4 py-3">Moneda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byTool.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Todavía no hay licencias activas.
                      </td>
                    </tr>
                  )}
                  {stats.byTool.map((row) => (
                    <tr key={`${row.toolCode}-${row.currency}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-400">{row.toolCode}</span>{' '}
                        <span className="font-medium text-navy">{row.toolName}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">{row.count}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                        {formatMoney(row.totalCost, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Por unidad de negocio
            </h2>
            <ScrollableTable>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Área</th>
                    <th className="px-4 py-3 text-right">Licencias</th>
                    <th className="px-4 py-3 text-right">Costo MXN</th>
                    <th className="px-4 py-3 text-right">Costo USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byBusinessUnit.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Todavía no hay licencias activas.
                      </td>
                    </tr>
                  )}
                  {stats.byBusinessUnit.map((row) => (
                    <tr key={row.unit} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-navy">{row.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">{row.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">
                        {formatMoney(row.costMXN, 'MXN')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">
                        {formatMoney(row.costUSD, 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      )}

      {/* ── TAB 2 · Licencias ──────────────────────────────────────────── */}
      {tab === 'licencias' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pushParams({ search, page: 1 });
                }}
                placeholder="Buscar por colaborador, herramienta o folio…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
              />
            </div>

            <select
              value={filters.toolId}
              onChange={(e) => pushParams({ toolId: e.target.value, page: 1 })}
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
              value={filters.businessUnit}
              onChange={(e) => pushParams({ businessUnit: e.target.value, page: 1 })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todas las áreas</option>
              {businessUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => pushParams({ status: e.target.value, page: 1 })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todos los estados</option>
              {(Object.keys(LICENSE_STATUS_LABEL) as LicenseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LICENSE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            <select
              value={filters.currency}
              onChange={(e) => pushParams({ currency: e.target.value, page: 1 })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            >
              <option value="">Todas las monedas</option>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Herramienta</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3 text-right">Costo</th>
                  <th className="px-4 py-3">Moneda</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vence</th>
                  {canWrite && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.data.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 10 : 9} className="px-4 py-10 text-center text-slate-400">
                      No hay licencias que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {page.data.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.licenseCode}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{l.toolName}</p>
                      <p className="font-mono text-xs text-slate-400">{l.toolCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.licenseType ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-navy">{l.employeeName ?? 'Sin asignar'}</p>
                      {l.employeeEmail && (
                        <p className="text-xs text-slate-400">{l.employeeEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.businessUnit ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">
                      {formatMoney(l.unitCost, l.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.currency ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryCell date={l.expiresAt} />
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        {l.status !== 'cancelada' && (
                          <button
                            onClick={() => handleRevoke(l)}
                            disabled={busy === l.id}
                            className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
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

          {page.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Página {page.page} de {page.totalPages} · {page.total} licencias
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => pushParams({ page: page.page - 1 })}
                  disabled={page.page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-navy hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => pushParams({ page: page.page + 1 })}
                  disabled={page.page >= page.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-navy hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3 · Por colaborador ────────────────────────────────────── */}
      {tab === 'colaborador' && (
        <div className="space-y-4">
          <div className="max-w-md">
            <EmployeePicker
              label="Colaborador"
              value={employee}
              onSelect={(emp) => void loadEmployeeLicenses(emp)}
            />
          </div>

          {!employee && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Busca un colaborador para ver sus licencias.
            </p>
          )}

          {employee && loadingEmployee && (
            <p className="px-4 py-6 text-sm text-slate-400">Cargando licencias…</p>
          )}

          {employee && !loadingEmployee && employeeLicenses && (
            <>
              <div className="flex flex-wrap gap-4">
                {Object.keys(employeeTotals).length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Costo total
                    </p>
                    <p className="mt-1 text-2xl font-bold text-navy">—</p>
                  </div>
                ) : (
                  Object.entries(employeeTotals).map(([currency, total]) => (
                    <div
                      key={currency}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Costo total {currency}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-navy">
                        {formatMoney(total, currency)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <ScrollableTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Herramienta</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3">Moneda</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Vence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeLicenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                          {employee.fullName} no tiene licencias asignadas.
                        </td>
                      </tr>
                    )}
                    {employeeLicenses.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {l.licenseCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-navy">{l.toolName}</td>
                        <td className="px-4 py-3 text-slate-600">{l.licenseType ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {formatMoney(l.unitCost, l.currency)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{l.currency ?? '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-3">
                          <ExpiryCell date={l.expiresAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </>
          )}
        </div>
      )}

      {dialogOpen && (
        <AssignLicenseDialog tools={tools} open={dialogOpen} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}
