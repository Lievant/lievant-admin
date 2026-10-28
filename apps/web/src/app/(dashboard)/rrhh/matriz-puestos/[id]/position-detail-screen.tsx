'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@/components/icons';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { ActivityDialog, ConfirmDelete, KpiDialog, OkrDialog } from '../item-dialogs';
import { PositionFormDialog, readError } from '../position-form-dialog';
import {
  BASE_PERIOD,
  EMPTY_OPTIONS,
  STATUS_BADGE,
  STATUS_LABELS,
  VALIDATION_BADGE,
  VALIDATION_LABELS,
  VALIDATION_STATUSES,
  currentPeriod,
  currentYearMx,
  formatDateTimeMx,
  formatPct,
  frequencyLabel,
  groupActivities,
  groupOkrs,
  hasAnyWeight,
  makePeriod,
  okrPeriodLabel,
  okrsOfPeriod,
  periodLabel,
  plazasLabel,
  seniorityLabel,
  parsePeriod,
  sumPeriodWeights,
  weightState,
  yearOptions,
  type ActivityItem,
  type KpiItem,
  type OkrItem,
  type PositionDetail,
  type PositionOptions,
  type ValidationStatus,
} from '../positions-constants';

const TABS = [
  { id: 'info', label: 'Información' },
  { id: 'activities', label: 'Actividades' },
  { id: 'okrs', label: 'OKRs' },
  { id: 'kpis', label: 'KPIs' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SELECT = 'rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none';
const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-navy">{value}</p>
    </div>
  );
}

/** Opciones del selector de periodo: la plantilla y los semestres de los años cercanos (y los que ya tengan datos). */
function periodOptions(okrs: OkrItem[]): string[] {
  const years = yearOptions(currentYearMx(), okrs.map((o) => parsePeriod(o.period ?? '')?.year ?? 0).filter(Boolean));
  return [BASE_PERIOD, ...years.flatMap((y) => [makePeriod(y, 2), makePeriod(y, 1)])];
}

export function PositionDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const canUpdate = usePermission('rrhh', 'matriz-puestos', 'update');
  const canDelete = usePermission('rrhh', 'matriz-puestos', 'delete');
  const canApprove = usePermission('rrhh', 'matriz-puestos', 'approve');
  // La asignación masiva exige ambos permisos: editar la Matriz y escribir en Desarrollo Organizacional.
  const canWriteDevelopment = usePermission('rrhh', 'desarrollo-organizacional', 'write');
  const canAssignBulk = canUpdate && canWriteDevelopment;

  const [position, setPosition] = useState<PositionDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [tab, setTab] = useState<TabId>('info');
  const [options, setOptions] = useState<PositionOptions>(EMPTY_OPTIONS);

  const [editing, setEditing] = useState(false);
  const [deletingPosition, setDeletingPosition] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Validación del Head (borrador de los campos; se guarda con su botón).
  const [vStatus, setVStatus] = useState<ValidationStatus>('pendiente');
  const [vComments, setVComments] = useState('');
  const [vSaved, setVSaved] = useState(false);

  // null = todavía sin elegir: la plantilla si el puesto la tiene, si no el semestre actual.
  const [periodChoice, setPeriodChoice] = useState<string | null>(null);
  const [okrDialog, setOkrDialog] = useState<OkrItem | 'new' | null>(null);
  const [okrToDelete, setOkrToDelete] = useState<OkrItem | null>(null);
  const [kpiDialog, setKpiDialog] = useState<KpiItem | 'new' | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<KpiItem | null>(null);
  const [activityDialog, setActivityDialog] = useState<{ activity: ActivityItem | null; group: { order: number; title: string } | null } | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<ActivityItem | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkPeriod, setBulkPeriod] = useState(currentPeriod());
  const [bulkResult, setBulkResult] = useState<{ employees: number; okrsCopied: number; okrsSkipped: number; kpisCopied: number; kpisSkipped: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hr/job-positions/${id}`);
      if (res.status === 404) return setState('missing');
      if (!res.ok) throw new Error();
      const data = (await res.json()) as PositionDetail;
      setPosition(data);
      setVStatus(data.validationStatus);
      setVComments(data.headComments ?? '');
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
  const period = periodChoice ?? (position.okrs.some((o) => o.period === null) ? BASE_PERIOD : currentPeriod());
  const okrsInPeriod = okrsOfPeriod(position.okrs, period);
  const activeInPeriod = okrsInPeriod.filter((o) => o.isActive);
  const sum = sumPeriodWeights(position.okrs, period);
  const anyWeight = hasAnyWeight(position.okrs, period);
  const wState = anyWeight ? weightState(sum, activeInPeriod.length) : 'empty';
  const otherPeriods = [...new Set(position.okrs.map((o) => o.period ?? BASE_PERIOD))].filter((p) => p !== period);
  const activityGroups = groupActivities(position.activities);
  const validationChanged = vStatus !== position.validationStatus || vComments.trim() !== (position.headComments ?? '');

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
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', VALIDATION_BADGE[position.validationStatus])}>{VALIDATION_LABELS[position.validationStatus]}</span>
          {position.vacant && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Vacante</span>}
        </div>
        <p className="mt-1 text-sm text-slate-500">{[position.division, position.area, position.level].filter(Boolean).join(' · ')}</p>
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
          <div className={CARD}>
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
              <Field label="División" value={position.division ?? '—'} />
              <Field label="Área" value={position.area} />
              <Field label="Nivel" value={position.level ?? '—'} />
              {position.levelOriginal && position.levelOriginal.trim().toUpperCase() !== (position.level ?? '') && (
                <Field label="Nivel Original (Excel)" value={position.levelOriginal} />
              )}
              <Field label="Categoría" value={seniorityLabel(position.seniority)} />
              <Field label="Jerarquía (MEOT)" value={position.meotHierarchy ?? '—'} />
              <Field label="Reporta a" value={position.reportsTo ?? '—'} />
              <Field label="Supervisa a" value={position.supervises ?? '—'} />
              <Field label="Plazas" value={plazasLabel(position.plazas)} />
              <Field label="Estado" value={STATUS_LABELS[position.status]} />
            </div>
          </div>

          <div className={CARD}>
            <h2 className="text-sm font-semibold text-navy">Rol y Objetivo</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Rol" value={position.roleSummary ?? '—'} />
              <Field label="Objetivo del Puesto" value={position.positionObjective ?? '—'} />
              <div className="lg:col-span-2">
                <Field label="Puntos a Validar" value={position.validationPoints ?? '—'} />
              </div>
            </div>
          </div>

          <div className={CARD}>
            <h2 className="text-sm font-semibold text-navy">Validación</h2>
            <p className="mt-1 text-xs text-slate-500">Validación del Head sobre la propuesta (rol, actividades, OKRs y KPIs); es independiente del estado del puesto y de la descripción.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="v-status" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estatus</label>
                {canUpdate ? (
                  <select id="v-status" value={vStatus} onChange={(e) => { setVStatus(e.target.value as ValidationStatus); setVSaved(false); }} className={SELECT}>
                    {VALIDATION_STATUSES.map((v) => <option key={v} value={v}>{VALIDATION_LABELS[v]}</option>)}
                  </select>
                ) : (
                  <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', VALIDATION_BADGE[position.validationStatus])}>{VALIDATION_LABELS[position.validationStatus]}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="v-comments" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comentarios del Head</label>
                {canUpdate ? (
                  <textarea id="v-comments" rows={3} value={vComments} maxLength={10000} onChange={(e) => { setVComments(e.target.value); setVSaved(false); }} className={cn(SELECT, 'w-full')} />
                ) : (
                  <p className="whitespace-pre-line text-sm text-navy">{position.headComments ?? '—'}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {position.validatedAt ? `Validado por ${position.validatedBy?.name ?? 'un usuario'} el ${formatDateTimeMx(position.validatedAt)}` : 'Sin validar'}
              </p>
              {canUpdate && (
                <div className="flex items-center gap-3">
                  {vSaved && <span className="text-xs text-emerald-700">Guardado</span>}
                  <button
                    type="button"
                    disabled={busy || !validationChanged}
                    onClick={() =>
                      run(
                        () =>
                          fetch(`/api/hr/job-positions/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ validationStatus: vStatus, headComments: vComments.trim() || null }),
                          }),
                        'No se pudo guardar la validación.',
                        () => { setVSaved(true); void load(); },
                      )
                    }
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {busy ? 'Guardando…' : 'Guardar Validación'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={CARD}>
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
              <p className="mt-3 text-sm text-slate-400">Descripción de puesto pendiente</p>
            )}
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div className="space-y-4">
          {canUpdate && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setActivityDialog({ activity: null, group: null })} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Nueva Actividad</button>
            </div>
          )}
          {activityGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">Aún No Hay Actividades Para Este Puesto</div>
          ) : (
            <div className="space-y-4">
              {activityGroups.map((g) => (
                <section key={`${g.order}-${g.title}`} className={CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-navy">{g.order}. {g.title}</h3>
                    {canUpdate && (
                      <button type="button" onClick={() => setActivityDialog({ activity: null, group: { order: g.order, title: g.title } })} className="text-xs font-medium text-slate-600 hover:text-navy">Agregar al Grupo</button>
                    )}
                  </div>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {g.items.map((a, i) => (
                      <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700"><span className="mr-2 text-xs font-semibold text-slate-400">{g.order}.{i + 1}</span>{a.description}</p>
                          {a.note && <p className="mt-0.5 pl-8 text-xs text-slate-500">{a.note}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{frequencyLabel(a.frequency)}</span>
                          {canUpdate && (
                            <>
                              <button type="button" onClick={() => setActivityDialog({ activity: a, group: null })} className="text-sm font-medium text-slate-600 hover:text-navy">Editar</button>
                              <button type="button" onClick={() => { setActionError(null); setActivityToDelete(a); }} className="text-sm font-medium text-red-600 hover:underline">Eliminar</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'okrs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="okr-period" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</label>
              <select id="okr-period" value={period} onChange={(e) => setPeriodChoice(e.target.value)} className={SELECT}>
                {periodOptions(position.okrs).map((p) => <option key={p} value={p}>{okrPeriodLabel(p)}</option>)}
              </select>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {canAssignBulk && (
                <button
                  type="button"
                  onClick={() => { setActionError(null); setBulkResult(null); setBulkPeriod(period === BASE_PERIOD ? currentPeriod() : period); setBulkConfirm(true); }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
                >
                  Asignar a Colaboradores del Puesto
                </button>
              )}
              {canUpdate && (
                <button type="button" onClick={() => setOkrDialog('new')} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Nuevo OKR</button>
              )}
            </div>
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
            <strong>{okrPeriodLabel(period)}</strong> · Suma: {anyWeight ? formatPct(sum) : '—'}
            {wState === 'incomplete' && ` · Falta ${formatPct(Math.round((100 - sum) * 100) / 100)} para llegar a 100 %`}
            {wState === 'complete' && ' · Completo'}
            {wState === 'over' && ' · Pasa de 100 %'}
            {activeInPeriod.length === 0 && ' · Sin OKRs activos en este periodo'}
            {activeInPeriod.length > 0 && !anyWeight && ' · Sin pesos asignados'}
          </div>
          {period === BASE_PERIOD && okrsInPeriod.length > 0 && (
            <p className="text-xs text-slate-500">La plantilla vale para cualquier semestre: al asignar OKRs a un colaborador se copia junto con los OKRs de ese semestre.</p>
          )}
          {otherPeriods.length > 0 && (
            <p className="text-xs text-slate-400">Otros periodos con OKRs: {otherPeriods.map(okrPeriodLabel).join(', ')}</p>
          )}

          {okrsInPeriod.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">No Hay OKRs En Este Periodo</div>
          ) : (
            <div className="space-y-3">
              {groupOkrs(okrsInPeriod).map((g) => (
                <section key={`${g.code}-${g.objective}`} className={CARD}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Objetivo{g.code ? ` ${g.code}` : ''}</p>
                  <p className="whitespace-pre-line text-sm font-medium text-navy">{g.code ? `${g.code} · ` : ''}{g.objective}</p>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {g.items.map((o) => (
                      <li key={o.id} className={cn('flex flex-wrap items-start justify-between gap-3 py-2.5', !o.isActive && 'opacity-60')}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado Clave{o.krCode ? ` ${o.krCode}` : ''}</p>
                          <p className="whitespace-pre-line text-sm text-slate-700">{o.keyResult}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{o.weight !== null ? formatPct(o.weight) : 'Sin peso'}</span>
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', o.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{o.isActive ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        {canUpdate && (
                          <div className="flex w-full gap-3 text-sm">
                            <button type="button" onClick={() => setOkrDialog(o)} className="font-medium text-slate-600 hover:text-navy">Editar</button>
                            <button type="button" onClick={() => { setActionError(null); setOkrToDelete(o); }} className="font-medium text-red-600 hover:underline">Eliminar</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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

      {activityDialog && (
        <ActivityDialog
          positionId={id}
          activity={activityDialog.activity}
          defaultGroup={activityDialog.group}
          onClose={() => setActivityDialog(null)}
          onSaved={() => {
            setActivityDialog(null);
            void load();
          }}
        />
      )}

      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Asignar a Colaboradores del Puesto</h2>
            {bulkResult ? (
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p><strong>{bulkResult.employees}</strong> {bulkResult.employees === 1 ? 'colaborador alcanzado' : 'colaboradores alcanzados'}.</p>
                <p>OKRs: {bulkResult.okrsCopied} copiados, {bulkResult.okrsSkipped} omitidos (ya asignados).</p>
                <p>KPIs: {bulkResult.kpisCopied} copiados, {bulkResult.kpisSkipped} omitidos (ya asignados).</p>
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor="bulk-period" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semestre a Asignar</label>
                  <select id="bulk-period" value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)} className={SELECT}>
                    {periodOptions(position.okrs).filter((p) => p !== BASE_PERIOD).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                  </select>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Se copiarán los OKRs activos de <strong>{periodLabel(bulkPeriod)}</strong> (más los de la plantilla, sin periodo) y los KPIs activos de <strong>{position.code} · {position.title}</strong> a todos los colaboradores activos con este puesto. Lo que ya tengan asignado se omite.
                </p>
              </>
            )}
            {actionError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkConfirm(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">{bulkResult ? 'Cerrar' : 'Cancelar'}</button>
              {!bulkResult && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setActionError(null);
                    try {
                      const res = await fetch(`/api/hr/job-positions/${id}/assign-to-employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period: bulkPeriod }) });
                      if (!res.ok) throw new Error(await readError(res, 'No se pudo asignar a los colaboradores.'));
                      setBulkResult(await res.json());
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'No se pudo asignar a los colaboradores.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? 'Asignando…' : 'Asignar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingPosition && (
        <ConfirmDelete
          title="Eliminar Puesto"
          message={<>¿Eliminar <strong>{position.code} · {position.title}</strong>? También se eliminarán sus actividades, OKRs y KPIs.</>}
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
      {activityToDelete && (
        <ConfirmDelete
          title="Eliminar Actividad"
          message="¿Eliminar esta actividad?"
          busy={busy}
          error={actionError}
          onCancel={() => setActivityToDelete(null)}
          onConfirm={() => run(() => fetch(`/api/hr/job-position-activities/${activityToDelete.id}`, { method: 'DELETE' }), 'No se pudo eliminar la actividad.', () => { setActivityToDelete(null); void load(); })}
        />
      )}
    </div>
  );
}
