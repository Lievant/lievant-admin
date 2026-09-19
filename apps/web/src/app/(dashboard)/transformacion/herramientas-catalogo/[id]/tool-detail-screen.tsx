'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/components/user-provider';
import type { ToolOptions, ToolRecord } from '@/lib/api';
import { deleteToolRecordAction } from '../actions';
import {
  BILLING_PERIOD_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  formatDate,
  formatMoney,
} from '../constants';
import { ToolDialog } from '../tool-dialog';

interface ToolDetailScreenProps {
  tool: ToolRecord;
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

export function ToolDetailScreen({ tool, options }: ToolDetailScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'herramientas' && p.action === 'write',
    );

  async function handleDelete() {
    if (!confirm(`¿Eliminar ${tool.toolCode} — ${tool.name}? Esta acción da de baja la herramienta.`))
      return;
    setBusy(true);
    setError(null);
    const result = await deleteToolRecordAction(tool.id);
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? 'No se pudo eliminar la herramienta.');
      return;
    }
    router.push('/transformacion/herramientas-catalogo');
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
              disabled={busy}
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
              Asignaciones activas
            </p>
            <p className="mt-1 text-3xl font-bold text-navy">{tool.activeAssignmentsCount}</p>
            {/* El detalle de quién la tiene vive en el módulo de Asignaciones,
                que es donde se dan de alta y se revocan. */}
            <Link
              href={`/transformacion/asignaciones?tab=asignaciones&toolId=${tool.id}`}
              className="mt-2 inline-block text-xs font-semibold text-navy hover:underline"
            >
              Ver asignaciones →
            </Link>
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

      {editing && options && (
        <ToolDialog options={options} tool={tool} open={editing} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
