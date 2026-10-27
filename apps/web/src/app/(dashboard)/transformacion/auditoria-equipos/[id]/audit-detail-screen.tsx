'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { avatarColor, initials } from '@/lib/avatar';
import type {
  EquipmentAuditDetail,
  EquipmentAuditEquipmentItem,
  EquipmentAuditLicenseItem,
  EquipmentAuditTechnician,
} from '@/lib/api';
import {
  AUDIT_STATUS_LABEL,
  AUDIT_STATUS_STYLE,
  errorMessageOf,
  formatDay,
  INPUT_CLASS,
  LABEL_CLASS,
  LOGICAL_CHECKS,
  normalizeMac,
  PHYSICAL_CHECKS,
  SURVEY_QUESTIONS,
} from '../constants';
import { useAuditPermissions } from '../use-audit-permissions';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TabKey = 'encabezado' | 'equipos' | 'mantenimiento' | 'encuesta' | 'resumen';

interface AuditDetailScreenProps {
  initialAudit: EquipmentAuditDetail;
  technicians: EquipmentAuditTechnician[];
}

// ── Controles con guardado ───────────────────────────────────────────────────

/**
 * Texto que se guarda al perder el foco, solo si cambió. Mientras tiene el foco
 * no se pisa con lo que devuelve el servidor por otro campo.
 */
function AutoText({
  value,
  onSave,
  disabled,
  placeholder,
  rows,
  id,
}: {
  value: string | null;
  onSave: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  id?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value ?? '');
  }, [value]);

  const props = {
    id,
    value: draft,
    disabled,
    placeholder,
    className: INPUT_CLASS,
    onFocus: () => {
      focused.current = true;
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => {
      focused.current = false;
      const next = draft.trim() ? draft : null;
      if ((next ?? '') !== (value ?? '')) onSave(next);
    },
  };
  return rows ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />;
}

/** Sí / No con estado "sin responder" (null). */
function YesNo({
  value,
  onChange,
  disabled,
  yes = 'Sí',
  no = 'No',
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  yes?: string;
  no?: string;
}) {
  const base = 'px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed';
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`${base} ${value === true ? 'bg-green-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        {yes}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`${base} border-l border-slate-200 ${value === false ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        {no}
      </button>
    </div>
  );
}

function Stars({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none transition disabled:cursor-not-allowed ${
            value !== null && n <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt={name} className="h-16 w-16 rounded-full object-cover" onError={() => setFailed(true)} />;
  }
  return (
    <span className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white ${avatarColor(name)}`}>
      {initials(name)}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      {children}
    </div>
  );
}

// ── Equipo ───────────────────────────────────────────────────────────────────

function EquipmentCard({
  item,
  readOnly,
  onPatch,
}: {
  item: EquipmentAuditEquipmentItem;
  readOnly: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [mac, setMac] = useState(item.macAddress ?? '');
  const [macError, setMacError] = useState<string | null>(null);
  useEffect(() => setMac(item.macAddress ?? ''), [item.macAddress]);

  function saveMac() {
    const normalized = normalizeMac(mac);
    if (normalized === null) {
      setMacError('Formato XX:XX:XX:XX:XX:XX');
      return;
    }
    setMacError(null);
    setMac(normalized);
    if (normalized !== (item.macAddress ?? '')) onPatch({ macAddress: normalized || null });
  }

  const label = [item.brand, item.model].filter(Boolean).join(' ') || 'Sin marca ni modelo';
  const macPending = !!item.macAddress && !item.macSyncedToInventory;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/transformacion/inventario/${item.equipmentId}`} className="font-mono text-xs font-semibold text-black hover:underline">
          {item.equipmentCode ?? '—'}
        </Link>
        <span className="text-sm font-medium text-navy">{label}</span>
        {item.type && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.type}</span>}
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        <Row label="¿Está presente?">
          <YesNo value={item.physicallyPresent} disabled={readOnly} onChange={(v) => onPatch({ physicallyPresent: v })} />
        </Row>

        {item.physicallyPresent === false && (
          <div className="space-y-3 py-3">
            <div>
              <label className={LABEL_CLASS}>¿Qué pasó?</label>
              <AutoText
                rows={2}
                value={item.notPresentReason}
                disabled={readOnly}
                placeholder="Ej. se quedó en casa, en reparación, extraviado…"
                onSave={(v) => onPatch({ notPresentReason: v })}
              />
            </div>
            {item.unassignedDuringAudit ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span>Se desasignará del colaborador al completar la auditoría (quedará como «Sin Verificar»).</span>
                {!readOnly && (
                  <button type="button" onClick={() => onPatch({ unassignedDuringAudit: false })} className="text-xs font-semibold hover:underline">
                    Deshacer
                  </button>
                )}
              </div>
            ) : (
              !readOnly && (
                <button
                  type="button"
                  onClick={() => onPatch({ unassignedDuringAudit: true })}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Desasignar equipo
                </button>
              )
            )}
          </div>
        )}

        <Row label="¿Marcado con ID Lievant?">
          <YesNo value={item.labelMarked} disabled={readOnly} onChange={(v) => onPatch({ labelMarked: v })} />
        </Row>

        {item.macEligible && (
          <div className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm text-slate-700" htmlFor={`mac-${item.id}`}>
                MAC Address
              </label>
              <div className="flex items-center gap-2">
                {macPending && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Se guardará en inventario
                  </span>
                )}
                <input
                  id={`mac-${item.id}`}
                  value={mac}
                  disabled={readOnly}
                  onChange={(e) => setMac(e.target.value)}
                  onBlur={saveMac}
                  placeholder="XX:XX:XX:XX:XX:XX"
                  className={`${INPUT_CLASS} w-48 font-mono`}
                />
              </div>
            </div>
            {macError && <p className="mt-1 text-right text-xs text-red-600">{macError}</p>}
          </div>
        )}

        {item.simCard && (
          <div className="space-y-2 py-2">
            <Row label={`Línea ${item.simCard.simCode ?? ''} · ${item.simCard.phoneNumber ?? ''}${item.simCard.plan ? ` · ${item.simCard.plan}` : ''}`}>
              <YesNo
                value={item.simVerified}
                yes="Verificada"
                no="No coincide"
                disabled={readOnly}
                onChange={(v) => onPatch({ simVerified: v })}
              />
            </Row>
            <AutoText value={item.simNotes} disabled={readOnly} placeholder="Notas de la línea" onSave={(v) => onPatch({ simNotes: v })} />
          </div>
        )}

        <div className="pt-3">
          <label className={LABEL_CLASS}>Notas del equipo</label>
          <AutoText rows={2} value={item.equipmentNotes} disabled={readOnly} onSave={(v) => onPatch({ equipmentNotes: v })} />
        </div>
      </div>
    </div>
  );
}

function LicenseRow({
  item,
  readOnly,
  onPatch,
}: {
  item: EquipmentAuditLicenseItem;
  readOnly: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-xs font-semibold text-slate-500">{item.toolCode}</span>{' '}
          <span className="text-sm font-medium text-navy">{item.toolName}</span>
        </div>
        <YesNo value={item.licensePresent} disabled={readOnly} onChange={(v) => onPatch({ licensePresent: v })} />
      </div>
      {item.licensePresent === false && (
        <div className="mt-2">
          <AutoText value={item.missingNotes} disabled={readOnly} placeholder="¿Qué falta?" onSave={(v) => onPatch({ missingNotes: v })} />
        </div>
      )}
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function AuditDetailScreen({ initialAudit, technicians }: AuditDetailScreenProps) {
  const { canWrite } = useAuditPermissions();
  const [audit, setAudit] = useState(initialAudit);
  const [tab, setTab] = useState<TabKey>('encabezado');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const inFlight = useRef(0);

  const readOnly = !canWrite || audit.status !== 'en_progreso';
  const base = `/api/audits/equipment/${audit.id}`;

  /** Toda escritura devuelve la auditoría completa: el estado se reemplaza con ella. */
  async function send(url: string, method: 'PATCH' | 'POST', body?: Record<string, unknown>) {
    inFlight.current += 1;
    setSaveState('saving');
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo guardar el cambio.'));
      setAudit((await res.json()) as EquipmentAuditDetail);
      inFlight.current -= 1;
      if (inFlight.current === 0) setSaveState('saved');
      return true;
    } catch (err) {
      inFlight.current -= 1;
      setSaveState('error');
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
      return false;
    }
  }

  const patchAudit = (body: Record<string, unknown>) => void send(base, 'PATCH', body);
  const patchEquipment = (id: string) => (body: Record<string, unknown>) =>
    void send(`${base}/equipment-items/${id}`, 'PATCH', body);
  const patchLicense = (id: string) => (body: Record<string, unknown>) =>
    void send(`${base}/license-items/${id}`, 'PATCH', body);

  async function complete() {
    setCompleting(true);
    const ok = await send(`${base}/complete`, 'POST');
    setCompleting(false);
    setConfirmOpen(false);
    if (ok) setJustCompleted(true);
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const eq = audit.equipmentItems;
  const lic = audit.licenseItems;
  const m = audit.maintenanceSection;
  const s = audit.surveySection;
  const checks = [...PHYSICAL_CHECKS, ...LOGICAL_CHECKS];
  const summary = [
    { label: 'Presencia de equipos verificada', done: eq.filter((e) => e.physicallyPresent !== null).length, total: eq.length, required: true },
    { label: 'Licencias verificadas', done: lic.filter((l) => l.licensePresent !== null).length, total: lic.length, required: true },
    { label: 'Equipos marcados con ID Lievant', done: eq.filter((e) => e.labelMarked === true).length, total: eq.length },
    { label: 'MAC registradas', done: eq.filter((e) => e.macEligible && e.macAddress).length, total: eq.filter((e) => e.macEligible).length },
    ...(audit.maintenanceApplies
      ? [{ label: 'Mantenimiento preventivo', done: checks.filter((c) => m[c.key] === true).length, total: checks.length }]
      : []),
    { label: 'Encuesta respondida', done: SURVEY_QUESTIONS.filter((q) => s[q.score] !== null).length, total: SURVEY_QUESTIONS.length },
  ];
  const blocking = summary.filter((x) => x.required).reduce((acc, x) => acc + (x.total - x.done), 0);
  const notPresent = eq.filter((e) => e.physicallyPresent === false);
  const missingLicenses = lic.filter((l) => l.licensePresent === false);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'encabezado', label: '1. Encabezado' },
    { key: 'equipos', label: '2. Equipos y Licencias' },
    ...(audit.maintenanceApplies ? [{ key: 'mantenimiento' as const, label: '3. Mantenimiento Preventivo' }] : []),
    { key: 'encuesta', label: `${audit.maintenanceApplies ? 4 : 3}. Encuesta` },
    { key: 'resumen', label: `${audit.maintenanceApplies ? 5 : 4}. Resumen y Finalizar` },
  ];

  return (
    <div>
      <Link href="/transformacion/auditoria-equipos" className="text-sm text-slate-500 hover:text-black hover:underline">
        ← Auditorías
      </Link>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-navy">
            <span className="font-mono">{audit.auditCode}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${AUDIT_STATUS_STYLE[audit.status]}`}>
              {AUDIT_STATUS_LABEL[audit.status]}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Auditoría de equipos TIC-RE-18 · {audit.employee.fullName} · {formatDay(audit.auditDate)}
          </p>
        </div>
        <p className="text-xs text-slate-400" aria-live="polite">
          {saveState === 'saving' && 'Guardando…'}
          {saveState === 'saved' && 'Cambios guardados'}
          {saveState === 'error' && <span className="text-red-600">No se guardó el último cambio</span>}
        </p>
      </header>

      {error && <div className="mt-4 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}

      {audit.status !== 'en_progreso' && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {justCompleted ? '¡Auditoría completada! ' : ''}
          La auditoría <strong>{audit.auditCode}</strong> se completó
          {audit.completedAt ? ` el ${new Date(audit.completedAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` : ''}.
          {audit.maintenanceTicket && (
            <>
              {' '}Ticket de mantenimiento{' '}
              <Link href={`/transformacion/tickets/${audit.maintenanceTicket.id}`} className="font-semibold underline">
                {audit.maintenanceTicket.displayId}
              </Link>
              .
            </>
          )}
        </div>
      )}

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-black text-black' : 'border-transparent text-slate-500 hover:text-black'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'encabezado' && (
          <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              <Avatar url={audit.employee.photoUrl} name={audit.employee.fullName} />
              <div>
                <p className="text-lg font-semibold text-navy">{audit.employee.fullName}</p>
                <p className="text-sm text-slate-500">
                  {audit.employee.position ?? '—'}
                  {audit.employee.area ? ` · ${audit.employee.area}` : ''}
                </p>
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="audit-date">
                Fecha
              </label>
              <input
                id="audit-date"
                type="date"
                defaultValue={audit.auditDate}
                disabled={readOnly}
                onBlur={(e) => e.target.value && e.target.value !== audit.auditDate && patchAudit({ auditDate: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="audit-technician">
                Técnico
              </label>
              <select
                id="audit-technician"
                value={audit.technician.id}
                disabled={readOnly}
                onChange={(e) => patchAudit({ technicianUserId: e.target.value })}
                className={INPUT_CLASS}
              >
                {!technicians.some((t) => t.userId === audit.technician.id) && (
                  <option value={audit.technician.id}>{audit.technician.fullName}</option>
                )}
                {technicians.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className={LABEL_CLASS}>Área</p>
              <p className="text-sm text-navy">{audit.employee.area ?? '—'}</p>
            </div>
            <div>
              <p className={LABEL_CLASS}>Cargo</p>
              <p className="text-sm text-navy">{audit.employee.position ?? '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="general-notes">
                Observaciones generales
              </label>
              <AutoText id="general-notes" rows={3} value={audit.generalNotes} disabled={readOnly} onSave={(v) => patchAudit({ generalNotes: v })} />
            </div>
          </div>
        )}

        {tab === 'equipos' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Equipos asignados ({eq.length})</h2>
              {eq.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">El colaborador no tenía equipos asignados al iniciar la auditoría.</p>
              ) : (
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  {eq.map((item) => (
                    <EquipmentCard key={item.id} item={item} readOnly={readOnly} onPatch={patchEquipment(item.id)} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Licencias asignadas ({lic.length})</h2>
              {lic.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">El colaborador no tenía licencias activas al iniciar la auditoría.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-5 shadow-sm">
                  <p className="pt-3 text-xs text-slate-400">¿Tiene la licencia?</p>
                  {lic.map((item) => (
                    <LicenseRow key={item.id} item={item} readOnly={readOnly} onPatch={patchLicense(item.id)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'mantenimiento' && audit.maintenanceApplies && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {[
              { title: 'Limpieza Física', items: PHYSICAL_CHECKS },
              { title: 'Mantenimiento Lógico', items: LOGICAL_CHECKS },
            ].map((group) => (
              <fieldset key={group.title}>
                <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.items.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={m[c.key] === true}
                        disabled={readOnly}
                        onChange={(e) => patchAudit({ [c.key]: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 accent-black"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div>
              <label className={LABEL_CLASS} htmlFor="shared-accounts">
                ¿Tiene cuentas compartidas?
              </label>
              <AutoText
                id="shared-accounts"
                value={m.maintenanceSharedAccounts}
                disabled={readOnly}
                placeholder="Deja vacío si no tiene"
                onSave={(v) => patchAudit({ maintenanceSharedAccounts: v })}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="maintenance-notes">
                Observaciones de mantenimiento
              </label>
              <AutoText id="maintenance-notes" rows={3} value={m.maintenanceNotes} disabled={readOnly} onSave={(v) => patchAudit({ maintenanceNotes: v })} />
            </div>
          </div>
        )}

        {tab === 'encuesta' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy">Cuéntanos cómo ha sido tu experiencia</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {SURVEY_QUESTIONS.map((q) => (
                <div key={q.score} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700">{q.label}</span>
                    <Stars value={s[q.score]} disabled={readOnly} onChange={(v) => patchAudit({ [q.score]: v })} />
                  </div>
                  <AutoText value={s[q.notes]} disabled={readOnly} placeholder="Comentario (opcional)" onSave={(v) => patchAudit({ [q.notes]: v })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Completado vs. pendiente</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {summary.map((x) => {
                  const complete = x.done >= x.total;
                  return (
                    <li key={x.label} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">
                        {x.label}
                        {x.required && <span className="ml-1 text-xs text-slate-400">(obligatorio)</span>}
                      </span>
                      <span className={`font-semibold ${complete ? 'text-green-600' : x.required ? 'text-red-600' : 'text-amber-600'}`}>
                        {x.total === 0 ? 'No aplica' : `${x.done} de ${x.total}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {(notPresent.length > 0 || missingLicenses.length > 0) && (
                <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  La auditoría cerrará <strong>con observaciones</strong>:
                  <ul className="mt-1 list-disc pl-5">
                    {notPresent.map((e) => (
                      <li key={e.id}>
                        {e.equipmentCode} no presente{e.unassignedDuringAudit ? ' — se desasignará' : ''}
                      </li>
                    ))}
                    {missingLicenses.map((l) => (
                      <li key={l.id}>Falta la licencia {l.toolCode} {l.toolName}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {audit.status === 'en_progreso' && canWrite && (
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  disabled={blocking > 0 || saveState === 'saving'}
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Completar Auditoría
                </button>
                {blocking > 0 && (
                  <p className="text-xs text-slate-500">
                    Falta{blocking === 1 ? '' : 'n'} {blocking} verificaci{blocking === 1 ? 'ón' : 'ones'} obligatoria{blocking === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">Completar auditoría {audit.auditCode}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {eq.some((e) => e.macAddress && !e.macSyncedToInventory) && <li>Las MAC nuevas se guardarán en el inventario.</li>}
              {notPresent.some((e) => e.unassignedDuringAudit) && <li>Los equipos marcados se desasignarán del colaborador.</li>}
              {audit.maintenanceApplies && <li>Se creará un ticket cerrado de mantenimiento preventivo.</li>}
              <li>Se notificará al colaborador, a su jefe inmediato y a TI.</li>
              <li>Después ya no se podrá editar.</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void complete()}
                disabled={completing}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {completing ? 'Completando…' : 'Completar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
