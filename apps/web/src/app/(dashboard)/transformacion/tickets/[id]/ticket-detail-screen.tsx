'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { TicketAssignee, TicketAttachmentItem, TicketDetail, TicketPriority, TicketStatus } from '@/lib/api';
import { ChevronLeftIcon } from '@/components/icons';
import {
  escalateAction,
  updatePriorityAction,
  updateStatusAction,
  updateTicketAction,
} from './actions';

const SLA_HOURS: Record<TicketPriority, number> = { P1: 4, P2: 8, P3: 24, P4: 72 };

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-emerald-100 text-emerald-700',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-amber-100 text-amber-700',
  en_atencion: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const ACTION_LABELS: Record<string, string> = {
  creado: 'Ticket creado',
  estado_cambiado: 'Estado actualizado',
  escalado: 'Escalado',
  'actualizado.priority': 'Prioridad actualizada',
  'actualizado.assignedTo': 'Técnico asignado',
  'actualizado.diagnosis': 'Diagnóstico agregado',
  'actualizado.solution': 'Solución registrada',
  'actualizado.internalNotes': 'Nota interna',
  'actualizado.collaboratorConfirmation': 'Confirmación de resolución',
};

function slaInfo(ticket: TicketDetail): { pct: number; label: string; color: string } | null {
  if (!ticket.priority) return null;
  const limit = SLA_HOURS[ticket.priority];
  if (!limit) return null;
  const start = new Date(ticket.requestedAt).getTime();
  const end = ticket.closedAt ? new Date(ticket.closedAt).getTime() : Date.now();
  const elapsed = (end - start) / 3_600_000;
  const pct = Math.min((elapsed / limit) * 100, 100);
  const label = `${elapsed.toFixed(1)}h / ${limit}h`;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-400' : 'bg-emerald-400';
  return { pct, label, color };
}

interface TicketDetailScreenProps {
  ticket: TicketDetail;
  isTd: boolean;
  isOwner: boolean;
}

export function TicketDetailScreen({ ticket, isTd, isOwner }: TicketDetailScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<TicketAssignee[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState(ticket.assignedTo ?? '');

  useEffect(() => {
    if (!isTd) return;
    fetch('/api/helpdesk/assignees')
      .then((r) => r.json() as Promise<TicketAssignee[]>)
      .then(setAssignees)
      .catch(() => {});
  }, [isTd]);

  // TD panel state
  const [newStatus, setNewStatus] = useState<TicketStatus>(ticket.status);
  const [statusNotes, setStatusNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis ?? '');
  const [solution, setSolution] = useState(ticket.solution ?? '');
  const [internalNotes, setInternalNotes] = useState(ticket.internalNotes ?? '');
  const [priority, setPriority] = useState<TicketPriority | ''>(ticket.priority ?? '');
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);

  function refresh() { router.refresh(); }

  async function handleStatusUpdate() {
    setError(null);
    startTransition(async () => {
      const r = await updateStatusAction(ticket.id, newStatus, statusNotes || undefined);
      if (r.success) { setStatusNotes(''); refresh(); }
      else setError(r.error ?? 'Error.');
    });
  }

  async function handleUpdateDiagnosis() {
    setError(null);
    startTransition(async () => {
      const r = await updateTicketAction(ticket.id, {
        diagnosis: diagnosis || undefined,
        solution: solution || undefined,
        internalNotes: internalNotes || undefined,
      });
      if (r.success) refresh();
      else setError(r.error ?? 'Error.');
    });
  }

  async function handlePriorityUpdate() {
    if (!priority) return;
    setError(null);
    startTransition(async () => {
      const r = await updatePriorityAction(ticket.id, priority);
      if (r.success) refresh();
      else setError(r.error ?? 'Error.');
    });
  }

  async function handleEscalate() {
    if (!escalateTo || !escalateReason) return;
    setError(null);
    startTransition(async () => {
      const r = await escalateAction(ticket.id, { escalateTo, reason: escalateReason });
      if (r.success) { setShowEscalate(false); refresh(); }
      else setError(r.error ?? 'Error.');
    });
  }

  async function handleConfirmResolution() {
    setError(null);
    startTransition(async () => {
      const r = await updateTicketAction(ticket.id, { collaboratorConfirmation: true });
      if (r.success) refresh();
      else setError(r.error ?? 'Error.');
    });
  }

  async function handleReportRecurrence() {
    setError(null);
    startTransition(async () => {
      const r = await updateStatusAction(ticket.id, 'abierto', 'Reapertura: problema recurrente.');
      if (r.success) refresh();
      else setError(r.error ?? 'Error.');
    });
  }

  const sla = slaInfo(ticket);
  const closedDaysAgo = ticket.closedAt
    ? (Date.now() - new Date(ticket.closedAt).getTime()) / 86_400_000
    : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/transformacion/tickets" className="flex items-center gap-1 hover:text-slate-700">
          <ChevronLeftIcon className="h-4 w-4" />
          Tickets
        </Link>
        <span>/</span>
        <span className="font-mono font-medium text-slate-600">{ticket.displayId}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Columna izquierda 2/3 ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-slate-400">{ticket.displayId}</span>
                {ticket.isHistorical && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    Histórico
                  </span>
                )}
                <h1 className="mt-1 text-xl font-bold text-navy capitalize">
                  {ticket.category}
                  {ticket.subcategory && ` — ${ticket.subcategory}`}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ticket.priority && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', PRIORITY_STYLES[ticket.priority])}>
                    {ticket.priority}
                  </span>
                )}
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[ticket.status])}>
                  {STATUS_LABELS[ticket.status]}
                </span>
                {sla && (
                  <span
                    className={cn(
                      'inline-block h-3 w-3 rounded-full',
                      sla.pct >= 100 ? 'bg-red-500' : sla.pct >= 75 ? 'bg-amber-400' : 'bg-emerald-400',
                    )}
                    title={`SLA: ${sla.label}`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Descripción</h2>
            <p className="whitespace-pre-line text-sm text-slate-700">{ticket.description}</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-400">
              <span>Impacto: <strong className="capitalize">{ticket.impact}</strong></span>
              {ticket.equipmentId && <span>Equipo: <strong>{ticket.equipmentId}</strong></span>}
            </div>
          </div>

          {/* Diagnóstico / Solución — visible cuando TD los llene */}
          {(ticket.diagnosis || ticket.solution) && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {ticket.diagnosis && (
                <div className="mb-4">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Diagnóstico</h2>
                  <p className="whitespace-pre-line text-sm text-slate-700">{ticket.diagnosis}</p>
                </div>
              )}
              {ticket.solution && (
                <div>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Solución</h2>
                  <p className="whitespace-pre-line text-sm text-slate-700">{ticket.solution}</p>
                </div>
              )}
            </div>
          )}

          {/* Adjuntos */}
          {ticket.attachments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Adjuntos
              </h2>
              <ul className="space-y-2">
                {ticket.attachments.map((a) => (
                  <AttachmentRow key={a.id} attachment={a} />
                ))}
              </ul>
            </div>
          )}

          {/* Historial */}
          {ticket.history.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Historial</h2>
              <ol className="space-y-4">
                {ticket.history.map((h) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-700">
                          {ACTION_LABELS[h.action] ?? h.action}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(h.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      {(h.oldValue || h.newValue) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {h.oldValue && <span className="line-through opacity-60">{h.oldValue}</span>}
                          {h.oldValue && h.newValue && <span className="mx-1">→</span>}
                          {h.newValue && <span>{h.newValue}</span>}
                        </p>
                      )}
                      {h.notes && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{h.notes}</p>}
                      {h.userName && <p className="mt-0.5 text-xs text-slate-400">por {h.userName}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── Columna derecha 1/3 ── */}
        <div className="space-y-4">
          {/* Datos del ticket */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Solicitante" value={ticket.requesterName} />
              {ticket.requesterArea && <Row label="Área" value={ticket.requesterArea} />}
              <Row
                label="Fecha"
                value={new Date(ticket.requestedAt).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
              />
              {ticket.openedByTd && ticket.openedOnBehalfOf && (
                <Row label="Abierto en nombre de" value={ticket.openedOnBehalfOf} />
              )}
              {ticket.escalatedTo && (
                <Row label="Escalado a" value={ticket.escalatedTo} accent="text-red-600" />
              )}
            </dl>
          </div>

          {/* Asignación */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Asignación</h2>
            {isTd && assignees.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Técnico asignado</label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAssignee(val);
                    startTransition(async () => {
                      const r = await (await import('./actions')).updateTicketAction(ticket.id, {
                        assignedTo: val || undefined,
                      });
                      if (r.success) router.refresh();
                      else setError(r.error ?? 'Error al asignar técnico.');
                    });
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
                >
                  <option value="">— Sin asignar —</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.role ? ` (${a.role})` : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                <Row
                  label="Técnico"
                  value={ticket.assigneeName ?? (ticket.assignedTo ? `ID: ${ticket.assignedTo.substring(0, 8)}…` : '—')}
                />
              </dl>
            )}
            {ticket.estimatedDelivery && (
              <dl className="mt-2 space-y-2 text-sm">
                <Row
                  label="Entrega estimada"
                  value={new Date(ticket.estimatedDelivery).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                />
              </dl>
            )}
          </div>

          {/* SLA */}
          {sla && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">SLA</h2>
              <p className="mb-2 text-xs text-slate-500">{sla.label}</p>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={cn('h-2 rounded-full transition-all', sla.color)}
                  style={{ width: `${Math.min(sla.pct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-slate-400">{sla.pct.toFixed(0)}%</p>
            </div>
          )}

          {/* ── Panel de acciones TD ── */}
          {isTd && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Acciones TD</h2>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
              )}

              {/* Cambiar estado */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Cambiar estado</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
                >
                  <option value="abierto">Abierto</option>
                  <option value="en_atencion">En atención</option>
                  <option value="en_revision">En revisión</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Nota opcional…"
                  rows={2}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isPending || newStatus === ticket.status}
                  onClick={handleStatusUpdate}
                  className="mt-1.5 w-full rounded-md bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  Actualizar estado
                </button>
              </div>

              {/* Prioridad */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Prioridad</label>
                <div className="flex gap-1.5">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
                  >
                    <option value="">—</option>
                    <option value="P1">P1 — Crítica</option>
                    <option value="P2">P2 — Alta</option>
                    <option value="P3">P3 — Media</option>
                    <option value="P4">P4 — Baja</option>
                  </select>
                  <button
                    type="button"
                    disabled={isPending || !priority || priority === ticket.priority}
                    onClick={handlePriorityUpdate}
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              </div>

              {/* Diagnóstico y solución */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Diagnóstico</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="Describe el diagnóstico técnico…"
                />
                <label className="mb-1 mt-2 block text-xs font-medium text-slate-600">Solución</label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="Describe la solución aplicada…"
                />
                <label className="mb-1 mt-2 block text-xs font-medium text-slate-600">Notas internas</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="Solo visible para TD…"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleUpdateDiagnosis}
                  className="mt-1.5 w-full rounded-md bg-slate-700 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Guardar diagnóstico y notas
                </button>
              </div>

              {/* Escalar */}
              <div>
                {!showEscalate ? (
                  <button
                    type="button"
                    onClick={() => setShowEscalate(true)}
                    className="w-full rounded-md border border-red-300 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Escalar a Director
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={escalateTo}
                      onChange={(e) => setEscalateTo(e.target.value)}
                      placeholder="Nombre del director…"
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                    />
                    <textarea
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="Motivo del escalamiento…"
                      rows={2}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={isPending || !escalateTo || !escalateReason}
                        onClick={handleEscalate}
                        className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        Escalar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEscalate(false)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Acciones colaborador ── */}
          {!isTd && isOwner && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acciones</h2>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
              )}

              {ticket.status === 'resuelto' && !ticket.collaboratorConfirmation && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmResolution}
                  className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Confirmar resolución
                </button>
              )}

              {ticket.status === 'cerrado' && closedDaysAgo !== null && closedDaysAgo <= 7 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleReportRecurrence}
                  className="w-full rounded-md border border-amber-300 bg-amber-50 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                >
                  Reportar recurrencia
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={cn('text-right font-medium text-slate-700', accent)}>{value}</dd>
    </div>
  );
}

function AttachmentRow({ attachment: a }: { attachment: TicketAttachmentItem }) {
  const isPdf = a.mimeType === 'application/pdf';
  const isImage = a.mimeType?.startsWith('image/');
  const sizeKb = a.fileSize ? Math.round(a.fileSize / 1024) : null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-lg">
          {isPdf ? '📄' : isImage ? '🖼️' : '📎'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy">{a.fileName}</p>
          <p className="text-xs text-slate-400">
            {sizeKb !== null ? `${sizeKb} KB · ` : ''}
            {new Date(a.uploadedAt).toLocaleDateString('es-MX', { dateStyle: 'short' })}
          </p>
        </div>
      </div>
      <a
        href={a.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Descargar
      </a>
    </li>
  );
}
