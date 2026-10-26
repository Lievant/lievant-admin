'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@/components/icons';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { ConfirmDelete, KpiDialog, OkrDialog } from '../item-dialogs';
import { PositionFormDialog, readError } from '../position-form-dialog';
import {
  STATUS_BADGE,
  STATUS_LABELS,
  currentPeriod,
  currentYearMx,
  formatDateTimeMx,
  formatPct,
  frequencyLabel,
  makePeriod,
  parsePeriod,
  periodLabel,
  sumPeriodWeights,
  weightState,
  yearOptions,
  type KpiItem,
  type OkrItem,
  type PositionDetail,
} from '../positions-constants';

const TABS = [
  { id: 'info', label: 'Información' },
  { id: 'okrs', label: 'OKRs' },
  { id: 'kpis', label: 'KPIs' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SELECT = 'rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm text-navy">{value}</p>
    </div>
  );
}

export function PositionDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const canUpdate = usePermission('rrhh', 'matriz-puestos', 'update');
  const canDelete = usePermission('rrhh', 'matriz-puestos', 'delete');
  const canApprove = usePermission('rrhh', 'matriz-puestos', 'approve');

  const [position, setPosition] = useState<PositionDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [tab, setTab] = useState<TabId>('info');
  const [options, setOptions] = useState({ areas: [] as string[], businessUnits: [] as string[], levels: [] as string[] });

  const [editing, setEditing] = useState(false);
  const [deletingPosition, setDeletingPosition] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [period, setPeriod] = useState(currentPeriod());
  const [okrDialog, setOkrDialog] = useState<OkrItem | 'new' | null>(null);
  const [okrToDelete, setOkrToDelete] = useState<OkrItem | null>(null);
  const [kpiDialog, setKpiDialog] = useState<KpiItem | 'new' | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<KpiItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hr/job-positions/${id}`);
      if (res.status === 404) return setState('missing');
      if (!res.ok) throw new Error();
      setPosition((await res.json()) as PositionDetail);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
    fetch('/api/hr/job-positions/options')
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOptions(o))
      .catch(() => undefined);
  }, [load]);

  const run = async (fn: () => Promise<Response>, fallback: string, after: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error(await readError(res, fallback));
      after();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return <p className="text-sm text-slate-400">Cargando…</p>;
  if (state === 'missing' || state === 'error' || !position) {
    return (
      <div className="space-y-3">
        <Link href="/rrhh/matriz-puestos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-black">
          <ChevronLeftIcon className="h-4 w-4" />
          Matriz de Puestos
        </Link>
        <p className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {state === 'missing' ? 'Este Puesto No Existe O Fue Eliminado' : 'No se pudo cargar el puesto.'}
        </p>
      </div>
    );
  }

  const approveVisible = canApprove && position.hasDescription && !position.descriptionApproved;
  const okrsInPeriod = position.okrs.filter((o) => o.period === period);
  const sum = sumPeriodWeights(position.okrs, period);
  const wState = weightState(sum, okrsInPeriod.filter((o) => o.isActive).length);
  const parsed = parsePeriod(period) ?? { year: currentYearMx(), semester: 1 as const };
  const periodsWithData = [...new Set(position.okrs.map((o) => o.period))].filter((p) => p !== period);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rrhh/matriz-puestos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-black">
          <ChevronLeftIcon className="h-4 w-4" />
          Matriz de Puestos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-navy">{position.title}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{position.code}</span>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[position.status])}>{STATUS_LABELS[position.status]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{[position.area, position.businessUnit, position.level].filter(Boolean).join(' · ')}</p>
      </div>

      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setActionError(null); }}
            className={cn('shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium', tab === t.id ? 'border-black text-black' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {tab === 'info' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-navy">Datos del Puesto</h2>
              <div className="flex flex-wrap gap-2">
                {canUpdate && (
                  <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300">Editar</button>
                )}
                {canDelete && (
                  <button type="button" onClick={() => { setActionError(null); setDeletingPosition(true); }} className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Eliminar Puesto</button>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Código" value={position.code} />
              <Field label="Puesto" value={position.title} />
              <Field label="Área" value={position.area} />
              <Field label="Unidad de Negocio" value={position.businessUnit ?? '—'} />
              <Field label="Nivel" value={position.level ?? '—'} />
              <Field label="Estado" value={STATUS_LABELS[position.status]} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-navy">Descripción del Puesto</h2>
              {approveVisible && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => fetch(`/api/hr/job-positions/${id}/approve-description`, { method: 'POST' }), 'No se pudo aprobar la descripción.', () => void load())}
                  className="rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {busy ? 'Aprobando…' : 'Aprobar Descripción'}
                </button>
              )}
            </div>
            {position.hasDescription ? (
              <>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{position.description}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {position.descriptionApproved
                    ? `Aprobada por ${position.approvedBy?.name ?? 'un usuario'} el ${formatDateTimeMx(position.approvedAt)}`
                    : 'Pendiente de aprobación'}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Descripción pendiente</p>
            )}
          </div>
        </div>
      )}

      {tab === 'okrs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="okr-p-year" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Año</label>
              <select id="okr-p-year" value={parsed.year} onChange={(e) => setPeriod(makePeriod(Number(e.target.value), parsed.semester))} className={SELECT}>
                {yearOptions(currentYearMx(), position.okrs.map((o) => parsePeriod(o.period)?.year ?? 0).filter(Boolean)).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="okr-p-sem" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semestre</label>
              <select id="okr-p-sem" value={parsed.semester} onChange={(e) => setPeriod(makePeriod(parsed.year, Number(e.target.value) as 1 | 2))} className={SELECT}>
                <option value={1}>Semestre 1</option>
                <option value={2}>Semestre 2</option>
              </select>
            </div>
            {canUpdate && (
              <button type="button" onClick={() => setOkrDialog('new')} className="ml-auto rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Nuevo OKR</button>
            )}
          </div>

          <div
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              wState === 'complete' && 'bg-emerald-50 text-emerald-800',
              wState === 'incomplete' && 'bg-amber-50 text-amber-800',
              wState === 'over' && 'bg-red-50 text-red-700',
              wState === 'empty' && 'bg-slate-50 text-slate-500',
            )}
          >
            <strong>{periodLabel(period)}</strong> · Suma: {formatPct(sum)}
            {wState === 'incomplete' && ` · Falta ${formatPct(Math.round((100 - sum) * 100) / 100)} para llegar a 100 %`}
            {wState === 'complete' && ' · Completo'}
            {wState === 'over' && ' · Pasa de 100 %'}
            {wState === 'empty' && ' · Sin OKRs activos en este periodo'}
          </div>
          {periodsWithData.length > 0 && (
            <p className="text-xs text-slate-400">Otros periodos con OKRs: {periodsWithData.map(periodLabel).join(', ')}</p>
          )}

          {okrsInPeriod.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">No Hay OKRs En Este Periodo</div>
          ) : (
            <ul className="space-y-3">
              {okrsInPeriod.map((o) => (
                <li key={o.id} className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', !o.isActive && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Objetivo</p>
                      <p className="whitespace-pre-line text-sm font-medium text-navy">{o.objective}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado Clave</p>
                      <p className="whitespace-pre-line text-sm text-slate-700">{o.keyResult}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{o.weight !== null ? formatPct(o.weight) : 'Sin peso'}</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', o.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{o.isActive ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                  {canUpdate && (
                    <div className="mt-3 flex gap-3 text-sm">
                      <button type="button" onClick={() => setOkrDialog(o)} className="font-medium text-slate-600 hover:text-navy">Editar</button>
                      <button type="button" onClick={() => { setActionError(null); setOkrToDelete(o); }} className="font-medium text-red-600 hover:underline">Eliminar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'kpis' && (
        <div className="space-y-4">
          {canUpdate && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setKpiDialog('new')} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Nuevo KPI</button>
            </div>
          )}
          {position.kpis.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">Aún No Hay KPIs Para Este Puesto</div>
          ) : (
            <ul className="space-y-3">
              {position.kpis.map((k) => (
                <li key={k.id} className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', !k.isActive && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{k.name}</p>
                      {k.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{k.description}</p>}
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', k.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{k.isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meta</dt>
                      <dd className="text-navy">{k.targetValue ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Frecuencia</dt>
                      <dd className="text-navy">{frequencyLabel(k.measurementFrequency)}</dd>
                    </div>
                  </dl>
                  {canUpdate && (
                    <div className="mt-3 flex gap-3 text-sm">
                      <button type="button" onClick={() => setKpiDialog(k)} className="font-medium text-slate-600 hover:text-navy">Editar</button>
                      <button type="button" onClick={() => { setActionError(null); setKpiToDelete(k); }} className="font-medium text-red-600 hover:underline">Eliminar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <PositionFormDialog
          position={position}
          options={options}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}

      {okrDialog && (
        <OkrDialog
          positionId={id}
          okr={okrDialog === 'new' ? null : okrDialog}
          defaultPeriod={period}
          onClose={() => setOkrDialog(null)}
          onSaved={() => {
            setOkrDialog(null);
            void load();
          }}
        />
      )}

      {kpiDialog && (
        <KpiDialog
          positionId={id}
          kpi={kpiDialog === 'new' ? null : kpiDialog}
          onClose={() => setKpiDialog(null)}
          onSaved={() => {
            setKpiDialog(null);
            void load();
          }}
        />
      )}

      {deletingPosition && (
        <ConfirmDelete
          title="Eliminar Puesto"
          message={<>¿Eliminar <strong>{position.code} · {position.title}</strong>? También se eliminarán sus OKRs y KPIs.</>}
          busy={busy}
          error={actionError}
          onCancel={() => setDeletingPosition(false)}
          onConfirm={() => run(() => fetch(`/api/hr/job-positions/${id}`, { method: 'DELETE' }), 'No se pudo eliminar el puesto.', () => router.push('/rrhh/matriz-puestos'))}
        />
      )}
      {okrToDelete && (
        <ConfirmDelete
          title="Eliminar OKR"
          message="¿Eliminar este OKR? Su peso dejará de contar en la suma del periodo."
          busy={busy}
          error={actionError}
          onCancel={() => setOkrToDelete(null)}
          onConfirm={() => run(() => fetch(`/api/hr/job-position-okrs/${okrToDelete.id}`, { method: 'DELETE' }), 'No se pudo eliminar el OKR.', () => { setOkrToDelete(null); void load(); })}
        />
      )}
      {kpiToDelete && (
        <ConfirmDelete
          title="Eliminar KPI"
          message={<>¿Eliminar el KPI <strong>{kpiToDelete.name}</strong>?</>}
          busy={busy}
          error={actionError}
          onCancel={() => setKpiToDelete(null)}
          onConfirm={() => run(() => fetch(`/api/hr/job-position-kpis/${kpiToDelete.id}`, { method: 'DELETE' }), 'No se pudo eliminar el KPI.', () => { setKpiToDelete(null); void load(); })}
        />
      )}
    </div>
  );
}
