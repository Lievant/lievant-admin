'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { useCurrentUser } from '@/components/user-provider';
import type { EmployeeListItem, ToolDetail, ToolOptions } from '@/lib/api';
import {
  approveToolAssignmentAction,
  assignToolAction,
  deleteToolRecordAction,
  revokeToolAssignmentAction,
} from '../actions';
import {
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_STYLE,
  BILLING_PERIOD_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  formatDate,
  formatMoney,
} from '../constants';
import { ToolDialog } from '../tool-dialog';

interface ToolDetailScreenProps {
  tool: ToolDetail;
  employees: EmployeeListItem[];
  options: ToolOptions | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-navy">{children}</div>
    </div>
  );
}

export function ToolDetailScreen({ tool, employees, options }: ToolDetailScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    isAdmin: false,
    unitCostOverride: '',
    notes: '',
  });

  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'herramientas' && p.action === 'write',
    );

  // Solo se ofrecen quienes no tienen ya una asignación viva: el API lo rechaza
  // igual, pero listarlos invita a un error que no hace falta cometer.
  const assignedLive = useMemo(
    () => new Set(tool.assignments.filter((a) => !a.revokedAt).map((a) => a.employeeId)),
    [tool.assignments],
  );
  const assignable = useMemo(
    () => employees.filter((e) => !assignedLive.has(e.id)),
    [employees, assignedLive],
  );

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

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm.employeeId) {
      setError('Selecciona un colaborador.');
      return;
    }
    const ok = await run('assign', () =>
      assignToolAction(tool.id, {
        employeeId: assignForm.employeeId,
        isAdmin: assignForm.isAdmin,
        ...(assignForm.unitCostOverride
          ? { unitCostOverride: Number(assignForm.unitCostOverride) }
          : {}),
        ...(assignForm.notes.trim() ? { notes: assignForm.notes.trim() } : {}),
      }),
    );
    if (ok) setAssignForm({ employeeId: '', isAdmin: false, unitCostOverride: '', notes: '' });
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar ${tool.toolCode} — ${tool.name}? Esta acción da de baja la herramienta.`))
      return;
    const ok = await run('delete', () => deleteToolRecordAction(tool.id));
    if (ok) router.push('/transformacion/herramientas-catalogo');
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/transformacion/herramientas-catalogo"
          className="text-sm text-slate-500 hover:text-navy hover:underline"
        >
          ← Catálogo de Herramientas
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{tool.toolCode}</p>
          <h1 className="text-2xl font-bold text-navy">{tool.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tool.provider} · {tool.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
              CONTRACT_STATUS_STYLE[tool.contractStatus] ??
              'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            {CONTRACT_STATUS_LABEL[tool.contractStatus] ?? tool.contractStatus}
          </span>
          {canWrite && options && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
            >
              Editar
            </button>
          )}
          {canWrite && (
            <button
              onClick={handleDelete}
              disabled={busy === 'delete'}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ficha</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Costo unitario">{formatMoney(tool.unitCost, tool.currency)}</Field>
            <Field label="Periodo de facturación">
              {BILLING_PERIOD_LABEL[tool.billingPeriod] ?? tool.billingPeriod}
              {tool.billingDay ? ` · día ${tool.billingDay}` : ''}
            </Field>
            <Field label="Contacto comercial">{tool.commercialContact ?? '—'}</Field>
            <Field label="Próxima renovación">{formatDate(tool.nextRenewalDate)}</Field>
            <Field label="Requiere aprobación">{tool.requiresApproval ? 'Sí' : 'No'}</Field>
            <div className="sm:col-span-2">
              <Field label="Descripción">{tool.description || '—'}</Field>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Licencias activas
            </p>
            <p className="mt-1 text-3xl font-bold text-navy">{tool.activeAssignmentsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Costo total por periodo
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {formatMoney(tool.totalCostCalculated, tool.currency)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Anualizado {formatMoney(tool.annualCost, tool.currency)} · mensual{' '}
              {formatMoney(tool.monthlyCost, tool.currency)}
            </p>
          </div>
        </div>
      </div>

      {canWrite && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Asignar herramienta
          </h2>
          <form onSubmit={handleAssign} className="mt-4 grid gap-3 sm:grid-cols-5">
            <select
              value={assignForm.employeeId}
              onChange={(e) => setAssignForm((f) => ({ ...f, employeeId: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy sm:col-span-2"
            >
              <option value="">Selecciona un colaborador…</option>
              {assignable.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} — {e.area ?? 'Sin área'}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={assignForm.unitCostOverride}
              onChange={(e) => setAssignForm((f) => ({ ...f, unitCostOverride: e.target.value }))}
              placeholder={`Costo (def. ${tool.unitCost})`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <input
              value={assignForm.notes}
              onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notas"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={assignForm.isAdmin}
                  onChange={(e) => setAssignForm((f) => ({ ...f, isAdmin: e.target.checked }))}
                />
                Admin
              </label>
              <button
                type="submit"
                disabled={busy === 'assign'}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === 'assign' ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
          </form>
          {tool.requiresApproval && (
            <p className="mt-2 text-xs text-amber-700">
              Esta herramienta requiere aprobación: la asignación queda pendiente y no suma al costo
              hasta aprobarse.
            </p>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Asignaciones ({tool.assignments.length})
        </h2>
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Asignada</th>
                <th className="px-4 py-3">Revocada</th>
                <th className="px-4 py-3">Estado</th>
                {canWrite && <th className="px-4 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tool.assignments.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                    Esta herramienta no tiene asignaciones.
                  </td>
                </tr>
              )}
              {tool.assignments.map((a) => (
                <tr key={a.id} className={a.revokedAt ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{a.fullName}</p>
                    {a.corporateEmail && (
                      <p className="text-xs text-slate-400">{a.corporateEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.area ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(a.unitCostOverride ?? tool.unitCost, tool.currency)}
                    {a.unitCostOverride !== null && (
                      <span className="ml-1 text-xs text-slate-400">(ajustado)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.isAdmin ? 'Sí' : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(a.assignedAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.revokedAt ? new Date(a.revokedAt).toLocaleDateString('es-MX') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        ASSIGNMENT_STATUS_STYLE[a.status] ??
                        'bg-slate-100 text-slate-600 ring-slate-200'
                      }`}
                    >
                      {ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      {a.status === 'pendiente_aprobacion' && (
                        <button
                          onClick={() =>
                            run(`approve-${a.id}`, () =>
                              approveToolAssignmentAction(tool.id, a.id),
                            )
                          }
                          disabled={busy === `approve-${a.id}`}
                          className="mr-2 rounded px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      )}
                      {!a.revokedAt && (
                        <button
                          onClick={() => {
                            if (!confirm(`¿Revocar la licencia de ${a.fullName}?`)) return;
                            void run(`revoke-${a.id}`, () =>
                              revokeToolAssignmentAction(tool.id, a.id),
                            );
                          }}
                          disabled={busy === `revoke-${a.id}`}
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
      </div>

      {editing && options && (
        <ToolDialog
          options={options}
          tool={tool}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
