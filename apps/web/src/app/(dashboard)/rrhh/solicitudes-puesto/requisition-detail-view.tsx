import { cn } from '@/lib/utils';
import {
  PRIORITY_BADGE,
  STATUS_BADGE,
  STATUS_LABELS,
  countryLabel,
  formatDateTimeMx,
  formatDay,
  modalityLabel,
  priorityLabel,
  typeLabel,
  type RequisitionDetail,
} from './requisitions-constants';

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-navy">{value}</p>
    </div>
  );
}

/** Contenido de una solicitud en solo lectura; lo usan el líder y RRHH. */
export function RequisitionDetailView({ d, showRequester }: { d: RequisitionDetail; showRequester?: boolean }) {
  const position = d.positionLabel ?? '—';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{d.code}</span>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[d.status])}>{STATUS_LABELS[d.status]}</span>
        {d.priority && <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', PRIORITY_BADGE[d.priority])}>Prioridad {priorityLabel(d.priority)}</span>}
      </div>

      {d.needsMatrixPosition && d.status !== 'borrador' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este puesto no existe en la Matriz de Puestos: hay que crearlo en la Matriz de Puestos antes de publicar la vacante.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showRequester && <Field label="Solicitante" value={d.requesterName ?? '—'} />}
        <Field label="Tipo" value={typeLabel(d.type)} />
        <Field label="Puesto" value={d.jobPositionCode ? `${position} (${d.jobPositionCode})` : d.jobPositionId ? position : `${position} · Puesto nuevo`} />
        <Field label="Área" value={d.area || '—'} />
        <Field label="Fecha Requerida" value={formatDay(d.requiredDate)} />
        <Field label="Modalidad" value={modalityLabel(d.modality)} />
        <Field label="País" value={countryLabel(d.country)} />
        <Field label="Enviada" value={formatDateTimeMx(d.submittedAt)} />
        <Field label="Motivo" value={d.reason ?? '—'} wide />
        <Field label="Justificación de Negocio" value={d.businessJustification ?? '—'} wide />
        <Field label="Perfil Básico" value={d.basicProfile ?? '—'} wide />
      </div>

      {(d.status === 'aprobada' || d.status === 'rechazada') && (
        <div className={cn('rounded-lg px-3 py-3 text-sm', d.status === 'aprobada' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900')}>
          <p className="font-semibold">
            {d.status === 'aprobada' ? 'Aprobada' : 'Rechazada'} por {d.reviewedBy?.name ?? 'RRHH'} el {formatDateTimeMx(d.reviewedAt)}
          </p>
          {d.reviewComments ? <p className="mt-1 whitespace-pre-line">Comentarios: {d.reviewComments}</p> : <p className="mt-1 opacity-70">Sin comentarios.</p>}
        </div>
      )}
    </div>
  );
}
