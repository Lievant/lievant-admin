'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertIcon, CloseIcon, EyeIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { SortColumnHeader } from '@/components/ui/sort-column-header';
import { useCurrentUser } from '@/components/user-provider';
import { OwnerPicker, type OwnerValue } from './owner-picker';
import type { CurrentUser } from '@/lib/api';
import { nextSort, sortRows, type SortDir } from '@/lib/sort-rows';
import {
  ACTION_STATUSES,
  ASSET_TYPES,
  CATEGORIES,
  EFFICACY_SCALE,
  PROBABILITY_SCALE,
  SEVERITY_SCALE,
  THREATS,
  VULNERABILITIES,
  VULNERABILITY_SCALE,
  type ScaleOption,
} from './risk-catalogs';
import {
  calculateResidualRisk,
  calculateRiskValue,
  LEVEL_CLASS,
  LEVEL_DESCRIPTION,
  LEVEL_LABEL,
  riskLevel,
  type RiskLevel,
} from './risk-calculation';

// ── tipos ────────────────────────────────────────────────────────────────────

interface Risk {
  id: string;
  category: string;
  threat: string;
  vulnerability: string;
  affectedAsset: string;
  risk: string;
  vulnerabilityScore: number;
  severityScore: number;
  probabilityScore: number;
  riskValue: number;
  control: string;
  controlEfficacy: number;
  residualRisk: number;
  level: RiskLevel;
  reportedAt: string | null;
  mitigationStrategy: string | null;
  actions: string | null;
  estimatedResolutionDate: string | null;
  ownerUserId: string;
  owner: string;
  /** false si el usuario dueño hoy está inactivo. */
  ownerActive: boolean;
  actionStatus: string;
  updatedAt: string;
}

interface RiskList {
  data: Risk[];
  lastUpdate: string | null;
}

type SortKey =
  | 'category'
  | 'risk'
  | 'riskValue'
  | 'residualRisk'
  | 'owner'
  | 'actionStatus'
  | 'estimatedResolutionDate'
  | 'affectedAsset';

// ── utilidades ───────────────────────────────────────────────────────────────

function hasPermission(user: CurrentUser | null, action: 'read' | 'write'): boolean {
  if (!user) return false;
  if (user.roles.some((r) => r.name === 'SUPER_ADMIN')) return true;
  return user.permissions.some((p) => p.section === 'sgsi' && p.module === 'riesgos' && p.action === action);
}

/** 'AAAA-MM-DD' o timestamp ISO → "31 dic 2026"; vacío → "—". */
function formatDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message ?? fallback;
}

const STATUS_CLASS: Record<string, string> = {
  'No iniciado': 'bg-slate-100 text-slate-600',
  Pendiente: 'bg-amber-100 text-amber-700',
  Iniciado: 'bg-sky-100 text-sky-700',
  'En proceso': 'bg-indigo-100 text-indigo-700',
  Resuelto: 'bg-emerald-100 text-emerald-700',
};

function sortValue(risk: Risk, key: SortKey): string | number | null {
  switch (key) {
    case 'category':
      return risk.category;
    case 'risk':
      return risk.risk;
    case 'riskValue':
      return risk.riskValue;
    case 'residualRisk':
      return risk.residualRisk;
    case 'owner':
      return risk.owner;
    case 'actionStatus':
      return risk.actionStatus;
    case 'affectedAsset':
      return risk.affectedAsset;
    case 'estimatedResolutionDate': {
      if (!risk.estimatedResolutionDate) return null;
      const time = Date.parse(risk.estimatedResolutionDate);
      return Number.isNaN(time) ? null : time;
    }
  }
}

function LevelBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      title={LEVEL_DESCRIPTION[level]}
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_CLASS[level]}`}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  );
}

// ── pantalla ─────────────────────────────────────────────────────────────────

export function RisksScreen() {
  const user = useCurrentUser();
  const canWrite = hasPermission(user, 'write');

  const [risks, setRisks] = useState<Risk[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const [viewing, setViewing] = useState<Risk | null>(null);
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Risk | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/risks');
      if (res.status === 403) {
        setError('No tienes permiso para ver la Matriz de Riesgos.');
        return;
      }
      if (!res.ok) {
        setError('No se pudo cargar la Matriz de Riesgos.');
        return;
      }
      const list = (await res.json()) as RiskList;
      setRisks(list.data);
      setLastUpdate(list.lastUpdate);
      setError(null);
    } catch {
      setError('No se pudo cargar la Matriz de Riesgos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (sort ? sortRows(risks, (r) => sortValue(r, sort.key), sort.dir) : risks),
    [risks, sort],
  );
  const onSort = (key: SortKey) => setSort((current) => nextSort(current, key));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            Matriz de Riesgos a la Seguridad de la Información
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            TIC-RE-08 · Última actualización: {formatDate(lastUpdate)}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo riesgo
          </button>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando riesgos…</p>
      ) : !error && risks.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay riesgos registrados.{canWrite ? ' Usa "Nuevo riesgo" para agregar el primero.' : ''}
        </p>
      ) : (
        !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <SortColumnHeader label="Categoría" column="category" sort={sort} onSort={onSort} />
                  <SortColumnHeader label="Riesgo" column="risk" sort={sort} onSort={onSort} />
                  <SortColumnHeader label="Valor de riesgo" column="riskValue" sort={sort} onSort={onSort} align="right" />
                  <SortColumnHeader label="Riesgo residual" column="residualRisk" sort={sort} onSort={onSort} align="right" />
                  <SortColumnHeader label="Dueño" column="owner" sort={sort} onSort={onSort} />
                  <SortColumnHeader label="Estado de la acción" column="actionStatus" sort={sort} onSort={onSort} />
                  <SortColumnHeader label="Fecha estimada de solución" column="estimatedResolutionDate" sort={sort} onSort={onSort} />
                  <SortColumnHeader label="Activo afectado" column="affectedAsset" sort={sort} onSort={onSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{r.category}</td>
                    <td className="max-w-xs px-4 py-3 text-navy">
                      <p className="line-clamp-2" title={r.risk}>
                        {r.risk}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.riskValue}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-slate-700">{formatNumber(r.residualRisk)}</span>
                        <LevelBadge level={r.level} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.owner}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.actionStatus} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(r.estimatedResolutionDate)}</td>
                    <td className="max-w-[14rem] px-4 py-3 text-slate-600">
                      <p className="truncate" title={r.affectedAsset}>
                        {r.affectedAsset}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          className="rounded-md p-1 text-slate-400 hover:text-navy"
                          aria-label={`Ver riesgo: ${r.risk}`}
                          title="Ver"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing(r)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-navy hover:text-navy"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(r)}
                              className="rounded-md p-1 text-slate-400 hover:text-rose-600"
                              aria-label={`Eliminar riesgo: ${r.risk}`}
                              title="Eliminar"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {viewing && <ViewModal risk={viewing} onClose={() => setViewing(null)} />}

      {editing && canWrite && (
        <FormModal
          risk={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {deleting && canWrite && (
        <DeleteModal
          risk={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── modales ──────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-full w-full flex-col rounded-xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Cerrar">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
const fieldClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none disabled:opacity-60';

function scaleOf(scale: ScaleOption[], value: number): ScaleOption | undefined {
  return scale.find((s) => s.value === value);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="whitespace-pre-line text-sm text-navy">{children}</div>
    </div>
  );
}

function ViewModal({ risk, onClose }: { risk: Risk; onClose: () => void }) {
  const scoreField = (label: string, scale: ScaleOption[], value: number) => {
    const option = scaleOf(scale, value);
    return (
      <div key={label}>
        <p className={labelClass}>{label}</p>
        <p className="text-sm text-navy">
          {value} — {option?.label ?? '—'}
        </p>
        {option && <p className="mt-0.5 text-xs text-slate-500">{option.description}</p>}
      </div>
    );
  };
  return (
    <Modal title="Detalle del riesgo" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Categoría">{risk.category}</Field>
        <Field label="Activo afectado">{risk.affectedAsset}</Field>
        <Field label="Amenaza">{risk.threat}</Field>
        <Field label="Vulnerabilidad">{risk.vulnerability}</Field>
        <div className="md:col-span-2">
          <Field label="Riesgo">{risk.risk}</Field>
        </div>

        {scoreField('Vulnerabilidad', VULNERABILITY_SCALE, risk.vulnerabilityScore)}
        {scoreField('Severidad', SEVERITY_SCALE, risk.severityScore)}
        {scoreField('Probabilidad', PROBABILITY_SCALE, risk.probabilityScore)}
        <div>
          <p className={labelClass}>Valor de riesgo</p>
          <p className="text-sm font-semibold text-navy">{risk.riskValue}</p>
        </div>

        <div className="md:col-span-2">
          <Field label="Control">{risk.control}</Field>
        </div>

        {scoreField('Eficacia del control', EFFICACY_SCALE, risk.controlEfficacy)}
        <div>
          <p className={labelClass}>Riesgo residual</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy">{formatNumber(risk.residualRisk)}</span>
            <LevelBadge level={risk.level} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{LEVEL_DESCRIPTION[risk.level]}</p>
        </div>

        <Field label="Fecha de reporte">{formatDate(risk.reportedAt)}</Field>
        <Field label="Fecha estimada de solución">{formatDate(risk.estimatedResolutionDate)}</Field>
        <div className="md:col-span-2">
          <Field label="Estrategia de mitigación">{risk.mitigationStrategy ?? '—'}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Acciones">{risk.actions ?? '—'}</Field>
        </div>
        <Field label="Dueño">
          {risk.owner}
          {!risk.ownerActive && <span className="ml-1 text-xs text-amber-600">(inactivo)</span>}
        </Field>
        <div>
          <p className={labelClass}>Estado de la acción</p>
          <StatusBadge status={risk.actionStatus} />
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

// ── formulario ───────────────────────────────────────────────────────────────

interface FormState {
  category: string;
  affectedAsset: string;
  threat: string;
  vulnerability: string;
  risk: string;
  vulnerabilityScore: string;
  severityScore: string;
  probabilityScore: string;
  control: string;
  controlEfficacy: string;
  reportedAt: string;
  mitigationStrategy: string;
  actions: string;
  estimatedResolutionDate: string;
  owner: OwnerValue | null;
  actionStatus: string;
}

function initialState(risk: Risk | null): FormState {
  return {
    category: risk?.category ?? '',
    affectedAsset: risk?.affectedAsset ?? '',
    threat: risk?.threat ?? '',
    vulnerability: risk?.vulnerability ?? '',
    risk: risk?.risk ?? '',
    vulnerabilityScore: risk ? String(risk.vulnerabilityScore) : '',
    severityScore: risk ? String(risk.severityScore) : '',
    probabilityScore: risk ? String(risk.probabilityScore) : '',
    control: risk?.control ?? '',
    controlEfficacy: risk ? String(risk.controlEfficacy) : '',
    reportedAt: risk?.reportedAt ?? '',
    mitigationStrategy: risk?.mitigationStrategy ?? '',
    actions: risk?.actions ?? '',
    estimatedResolutionDate: risk?.estimatedResolutionDate ?? '',
    owner: risk ? { id: risk.ownerUserId, name: risk.owner, inactive: !risk.ownerActive } : null,
    actionStatus: risk?.actionStatus ?? 'No iniciado',
  };
}

function SuggestionInput({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        list={`${id}-options`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
      <datalist id={`${id}-options`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

function ScaleSelect({
  id,
  label,
  value,
  onChange,
  scale,
  disabled,
  format = String,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  scale: ScaleOption[];
  disabled: boolean;
  format?: (value: number) => string;
}) {
  const selected = scale.find((s) => String(s.value) === value);
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="">Selecciona…</option>
        {scale.map((s) => (
          <option key={s.value} value={s.value} title={s.description}>
            {format(s.value)} — {s.label}
          </option>
        ))}
      </select>
      <p className="mt-1 min-h-[2.25rem] text-xs text-slate-500">{selected?.description ?? ''}</p>
    </div>
  );
}

function FormModal({
  risk,
  onClose,
  onDone,
}: {
  risk: Risk | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(risk));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: Exclude<keyof FormState, 'owner'>) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Vista previa con la misma fórmula del backend; el servidor recalcula siempre.
  const preview = useMemo(() => {
    const v = Number(form.vulnerabilityScore);
    const s = Number(form.severityScore);
    const p = Number(form.probabilityScore);
    const e = Number(form.controlEfficacy);
    if (!form.vulnerabilityScore || !form.severityScore || !form.probabilityScore || !form.controlEfficacy) {
      return null;
    }
    const riskValue = calculateRiskValue(v, s, p);
    const residual = calculateResidualRisk(riskValue, e);
    return { riskValue, residual, level: riskLevel(residual) };
  }, [form.vulnerabilityScore, form.severityScore, form.probabilityScore, form.controlEfficacy]);

  async function submit() {
    if (saving) return;

    const required: [Exclude<keyof FormState, 'owner'>, string][] = [
      ['category', 'la categoría'],
      ['affectedAsset', 'el activo afectado'],
      ['threat', 'la amenaza'],
      ['vulnerability', 'la vulnerabilidad'],
      ['risk', 'el riesgo'],
      ['vulnerabilityScore', 'el valor de vulnerabilidad'],
      ['severityScore', 'la severidad'],
      ['probabilityScore', 'la probabilidad'],
      ['control', 'el control'],
      ['controlEfficacy', 'la eficacia del control'],
    ];
    const missing = required.find(([field]) => !form[field].trim());
    if (missing) {
      setError(`Indica ${missing[1]}.`);
      return;
    }
    if (!form.owner) {
      setError('Elige al dueño de la lista.');
      return;
    }

    const editing = risk !== null;
    // Solo viajan los datos capturados; valor de riesgo y residual los calcula el servidor.
    const payload: Record<string, unknown> = {
      category: form.category.trim(),
      affectedAsset: form.affectedAsset.trim(),
      threat: form.threat.trim(),
      vulnerability: form.vulnerability.trim(),
      risk: form.risk.trim(),
      vulnerabilityScore: Number(form.vulnerabilityScore),
      severityScore: Number(form.severityScore),
      probabilityScore: Number(form.probabilityScore),
      control: form.control.trim(),
      controlEfficacy: Number(form.controlEfficacy),
      ownerUserId: form.owner.id,
      actionStatus: form.actionStatus,
      // Al editar, vacío borra el valor (null); al crear, simplemente no se manda.
      ...(form.reportedAt || editing ? { reportedAt: form.reportedAt || null } : {}),
      ...(form.estimatedResolutionDate || editing
        ? { estimatedResolutionDate: form.estimatedResolutionDate || null }
        : {}),
      ...(form.mitigationStrategy.trim() || editing
        ? { mitigationStrategy: form.mitigationStrategy.trim() || null }
        : {}),
      ...(form.actions.trim() || editing ? { actions: form.actions.trim() || null } : {}),
    };

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/risks/${risk.id}` : '/api/risks', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? 'No tienes permiso para modificar la Matriz de Riesgos.'
            : errorMessage(await res.json().catch(() => null), 'No se pudo guardar el riesgo.'),
        );
        return;
      }
      onDone();
    } catch {
      setError('No se pudo guardar el riesgo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={risk ? 'Editar riesgo' : 'Nuevo riesgo'} onClose={saving ? () => undefined : onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <SuggestionInput id="risk-category" label="Categoría" value={form.category} onChange={set('category')} options={CATEGORIES} disabled={saving} placeholder="Ej. Ciberseguridad (IT)" />
        <SuggestionInput id="risk-asset" label="Activo afectado" value={form.affectedAsset} onChange={set('affectedAsset')} options={ASSET_TYPES} disabled={saving} placeholder="Ej. COR, M365…" />
        <SuggestionInput id="risk-threat" label="Amenaza" value={form.threat} onChange={set('threat')} options={THREATS} disabled={saving} placeholder="Elige del catálogo o escribe otra" />
        <SuggestionInput id="risk-vulnerability" label="Vulnerabilidad" value={form.vulnerability} onChange={set('vulnerability')} options={VULNERABILITIES} disabled={saving} placeholder="Elige del catálogo o escribe otra" />

        <div className="md:col-span-2">
          <label htmlFor="risk-risk" className={labelClass}>Riesgo</label>
          <textarea id="risk-risk" rows={2} value={form.risk} disabled={saving} onChange={(e) => set('risk')(e.target.value)} className={fieldClass} />
        </div>

        <ScaleSelect id="risk-vuln-score" label="Vulnerabilidad (1–5)" value={form.vulnerabilityScore} onChange={set('vulnerabilityScore')} scale={VULNERABILITY_SCALE} disabled={saving} />
        <ScaleSelect id="risk-severity" label="Severidad (1–5)" value={form.severityScore} onChange={set('severityScore')} scale={SEVERITY_SCALE} disabled={saving} />
        <ScaleSelect id="risk-probability" label="Probabilidad (1–5)" value={form.probabilityScore} onChange={set('probabilityScore')} scale={PROBABILITY_SCALE} disabled={saving} />

        {/* Calculado: solo lectura, no recibe foco. Se recalcula al guardar en el servidor. */}
        <div aria-live="polite">
          <p className={labelClass}>Valor de riesgo</p>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-navy">
            {preview ? preview.riskValue : '—'}
          </div>
          <p className="mt-1 text-xs text-slate-500">Vulnerabilidad × Severidad × Probabilidad.</p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="risk-control" className={labelClass}>Control</label>
          <textarea id="risk-control" rows={3} value={form.control} disabled={saving} onChange={(e) => set('control')(e.target.value)} className={fieldClass} />
        </div>

        <ScaleSelect id="risk-efficacy" label="Eficacia del control" value={form.controlEfficacy} onChange={set('controlEfficacy')} scale={EFFICACY_SCALE} disabled={saving} format={(v) => v.toFixed(1)} />

        <div aria-live="polite">
          <p className={labelClass}>Riesgo residual</p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-navy">{preview ? formatNumber(preview.residual) : '—'}</span>
            {preview && <LevelBadge level={preview.level} />}
          </div>
          <p className="mt-1 text-xs text-slate-500">Valor de riesgo × Eficacia del control. Se recalcula al guardar.</p>
        </div>

        <div>
          <label htmlFor="risk-reported" className={labelClass}>Fecha de reporte</label>
          <input id="risk-reported" type="date" value={form.reportedAt} disabled={saving} onChange={(e) => set('reportedAt')(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="risk-estimated" className={labelClass}>Fecha estimada de solución</label>
          <input id="risk-estimated" type="date" value={form.estimatedResolutionDate} disabled={saving} onChange={(e) => set('estimatedResolutionDate')(e.target.value)} className={fieldClass} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="risk-mitigation" className={labelClass}>Estrategia de mitigación (opcional)</label>
          <textarea id="risk-mitigation" rows={2} value={form.mitigationStrategy} disabled={saving} onChange={(e) => set('mitigationStrategy')(e.target.value)} className={fieldClass} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="risk-actions" className={labelClass}>Acciones (opcional)</label>
          <textarea id="risk-actions" rows={2} value={form.actions} disabled={saving} onChange={(e) => set('actions')(e.target.value)} className={fieldClass} />
        </div>

        <OwnerPicker
          id="risk-owner"
          label="Dueño"
          value={form.owner}
          onChange={(owner) => setForm((f) => ({ ...f, owner }))}
          disabled={saving}
        />
        <div>
          <label htmlFor="risk-status" className={labelClass}>Estado de la acción</label>
          <select id="risk-status" value={form.actionStatus} disabled={saving} onChange={(e) => set('actionStatus')(e.target.value)} className={fieldClass}>
            {ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 text-sm text-rose-600" role="alert">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando…' : risk ? 'Guardar cambios' : 'Crear riesgo'}
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({
  risk,
  onClose,
  onDone,
}: {
  risk: Risk;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/risks/${risk.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => null), 'No se pudo eliminar el riesgo.'));
        return;
      }
      onDone();
    } catch {
      setError('No se pudo eliminar el riesgo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Eliminar riesgo" onClose={busy ? () => undefined : onClose}>
      <p className="text-sm text-slate-600">
        El riesgo <span className="font-medium text-navy">“{risk.risk}”</span> dejará de aparecer en la
        Matriz de Riesgos. El registro se conserva como baja lógica.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  );
}
