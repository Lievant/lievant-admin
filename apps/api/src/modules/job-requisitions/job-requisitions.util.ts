import { BadRequestException } from '@nestjs/common';
import { isRealDate } from '../employees/trainings.util';

export const REQUISITION_TYPES = ['nueva_posicion', 'reemplazo', 'temporal'] as const;
export const MODALITIES = ['presencial', 'hibrido', 'remoto'] as const;
export const COUNTRIES = ['mexico', 'colombia', 'eeuu'] as const;
export const PRIORITIES = ['alta', 'media', 'baja'] as const;
export const STATUSES = ['borrador', 'enviada', 'aprobada', 'rechazada'] as const;
/** Estados que RRHH puede ver: nunca los borradores. */
export const REVIEWABLE_STATUSES = ['enviada', 'aprobada', 'rechazada'] as const;

export type RequisitionType = (typeof REQUISITION_TYPES)[number];
export type RequisitionStatus = (typeof STATUSES)[number];

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const NOT_FOUND = 'Solicitud no encontrada';
export const NOT_LINKED_CODE = 'EMPLOYEE_NOT_LINKED';
export const NOT_LINKED_MESSAGE = 'Tu Usuario Aún No Está Vinculado a un Empleado';
export const NOT_LEADER_CODE = 'NOT_A_LEADER';
export const NOT_LEADER_MESSAGE = 'Esta Sección Es Para Líderes con Colaboradores a Cargo';

export const TYPE_LABELS: Record<RequisitionType, string> = {
  nueva_posicion: 'Nueva Posición',
  reemplazo: 'Reemplazo',
  temporal: 'Temporal',
};

// ── Código consecutivo ───────────────────────────────────────────────────────

const CODE_REGEX = /^SOL-([0-9]+)$/;

/** 'SOL-001', 'SOL-099', 'SOL-1000': relleno a 3 dígitos y más si crece. */
export const formatRequisitionCode = (n: number): string => `SOL-${String(n).padStart(3, '0')}`;

/** Siguiente código sobre TODOS los existentes (incluidos eliminados): nunca se reutiliza. */
export function nextRequisitionCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const m = CODE_REGEX.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatRequisitionCode(max + 1);
}

// ── Fechas (America/Mexico_City) ─────────────────────────────────────────────

/** 'AAAA-MM-DD' de hoy en la oficina. */
export function todayMx(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

// ── Estado ───────────────────────────────────────────────────────────────────

/** Transiciones válidas: borrador → enviada → aprobada | rechazada. Lo resuelto ya no cambia. */
const TRANSITIONS: Record<RequisitionStatus, RequisitionStatus[]> = {
  borrador: ['enviada'],
  enviada: ['aprobada', 'rechazada'],
  aprobada: [],
  rechazada: [],
};

export const canTransition = (from: RequisitionStatus, to: RequisitionStatus): boolean => TRANSITIONS[from].includes(to);

/** El líder edita y elimina solo en borrador. */
export const isEditable = (status: RequisitionStatus): boolean => status === 'borrador';

// ── Validación al enviar ─────────────────────────────────────────────────────

/** Contenido de una solicitud tal como se valida al enviar. */
export interface RequisitionContent {
  type: string | null;
  jobPositionId: string | null;
  positionTitle: string | null;
  area: string | null;
  reason: string | null;
  businessJustification: string | null;
  requiredDate: string | null;
  modality: string | null;
  country: string | null;
  basicProfile: string | null;
  priority: string | null;
}

const blank = (v: string | null | undefined): boolean => v === null || v === undefined || v.trim() === '';

/** Errores por campo (vacío si todo está bien). Enviar los exige todos; guardar borrador no. */
export function validateForSubmit(c: RequisitionContent, today: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!c.type || !(REQUISITION_TYPES as readonly string[]).includes(c.type)) e.type = 'El tipo de solicitud es obligatorio';
  if (blank(c.jobPositionId) && blank(c.positionTitle)) {
    e.position = 'Elige un puesto de la Matriz o escribe el nombre del puesto nuevo';
  }
  if (blank(c.area)) e.area = 'El área es obligatoria';
  if (blank(c.reason)) e.reason = 'El motivo es obligatorio';
  if (blank(c.businessJustification)) e.businessJustification = 'La justificación de negocio es obligatoria';
  if (blank(c.requiredDate)) {
    e.requiredDate = 'La fecha requerida es obligatoria';
  } else if (!isRealDate(c.requiredDate as string)) {
    e.requiredDate = 'La fecha requerida no es válida';
  } else if ((c.requiredDate as string) < today) {
    e.requiredDate = 'La fecha requerida no puede ser anterior a hoy';
  }
  if (!c.modality || !(MODALITIES as readonly string[]).includes(c.modality)) e.modality = 'La modalidad es obligatoria';
  if (!c.country || !(COUNTRIES as readonly string[]).includes(c.country)) e.country = 'El país es obligatorio';
  if (blank(c.basicProfile)) e.basicProfile = 'El perfil básico es obligatorio';
  if (!c.priority || !(PRIORITIES as readonly string[]).includes(c.priority)) e.priority = 'La prioridad es obligatoria';
  return e;
}

/** Lanza 400 con un mensaje por campo faltante. */
export function assertSubmittable(c: RequisitionContent, today: string): void {
  const errors = validateForSubmit(c, today);
  const messages = Object.values(errors);
  if (messages.length > 0) {
    throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: messages, errors });
  }
}

/** Si hay puesto de la Matriz, el texto libre se ignora. */
export function normalizePosition(jobPositionId: string | null, positionTitle: string | null): { jobPositionId: string | null; positionTitle: string | null } {
  if (jobPositionId) return { jobPositionId, positionTitle: null };
  const t = (positionTitle ?? '').trim();
  return { jobPositionId: null, positionTitle: t === '' ? null : t };
}

/** Comentarios al resolver: rechazar los exige; aprobar los admite opcionales. */
export function normalizeReviewComments(decision: 'aprobada' | 'rechazada', comments: string | null | undefined): string | null {
  const c = (comments ?? '').trim();
  if (decision === 'rechazada' && c === '') throw new BadRequestException('Los comentarios son obligatorios al rechazar');
  return c === '' ? null : c;
}

// ── Notificaciones ───────────────────────────────────────────────────────────

export interface SubmittedNotice {
  code: string;
  requesterName: string;
  type: RequisitionType;
  positionLabel: string;
  priority: string | null;
  inMatrix: boolean;
}

/** Texto para quienes aprueban; avisa si hay que crear el puesto en la Matriz. */
export function buildSubmittedMessage(n: SubmittedNotice): string {
  let msg = `${n.requesterName} envió la solicitud ${n.code}: ${TYPE_LABELS[n.type]} · ${n.positionLabel}${n.priority ? ` (prioridad ${n.priority})` : ''}.`;
  if (n.type === 'nueva_posicion' && !n.inMatrix) {
    msg += ' El puesto no existe en la Matriz de Puestos: hay que crearlo en la Matriz de Puestos antes de publicar la vacante.';
  }
  return msg;
}

export function buildResolvedMessage(code: string, decision: 'aprobada' | 'rechazada', comments: string | null): string {
  const base = `Tu solicitud ${code} fue ${decision === 'aprobada' ? 'aprobada' : 'rechazada'} por RRHH.`;
  return comments ? `${base} Comentarios: ${comments}` : base;
}

// ── Listados ─────────────────────────────────────────────────────────────────

/** Texto del puesto: el de la Matriz si existe; si no, el libre. */
export const POSITION_LABEL_SQL = `COALESCE(jp.title, r.position_title)`;

export interface ReviewFilters {
  status?: string | undefined;
  area?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  search?: string | undefined;
}

/** Escapa % _ \ para usar el texto dentro de un ILIKE. */
export const escapeLike = (t: string): string => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** WHERE de RRHH: nunca borradores ni eliminadas; el rango se aplica al día de envío en hora de México. */
export function buildReviewWhere(f: ReviewFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses = ['r.deleted_at IS NULL', "r.status <> 'borrador'"];
  if (f.status) {
    params.push(f.status);
    clauses.push(`r.status = $${params.length}`);
  }
  if (f.area) {
    params.push(f.area);
    clauses.push(`r.area = $${params.length}`);
  }
  if (f.from) {
    params.push(f.from);
    clauses.push(`(r.submitted_at AT TIME ZONE 'America/Mexico_City')::date >= $${params.length}::date`);
  }
  if (f.to) {
    params.push(f.to);
    clauses.push(`(r.submitted_at AT TIME ZONE 'America/Mexico_City')::date <= $${params.length}::date`);
  }
  const s = f.search?.trim();
  if (s) {
    params.push(`%${escapeLike(s)}%`);
    clauses.push(`(r.code ILIKE $${params.length} OR ${POSITION_LABEL_SQL} ILIKE $${params.length})`);
  }
  return { where: clauses.join(' AND '), params };
}

/** Conteos del panel; el mes es el calendario de México sobre la fecha de resolución. */
export const SUMMARY_SQL = `
  SELECT
    COUNT(*) FILTER (WHERE status = 'enviada') AS pending,
    COUNT(*) FILTER (WHERE status = 'aprobada'
      AND date_trunc('month', reviewed_at AT TIME ZONE 'America/Mexico_City')
        = date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')) AS approved_this_month,
    COUNT(*) FILTER (WHERE status = 'rechazada'
      AND date_trunc('month', reviewed_at AT TIME ZONE 'America/Mexico_City')
        = date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')) AS rejected_this_month
  FROM hr.job_requisitions
  WHERE deleted_at IS NULL`;

// ── Vistas ───────────────────────────────────────────────────────────────────

export interface RequisitionRow {
  id: string;
  code: string;
  requester_employee_id: string;
  requester_user_id: string;
  requester_name?: string | null;
  type: RequisitionType;
  job_position_id: string | null;
  job_position_code?: string | null;
  position_label?: string | null;
  position_title: string | null;
  area: string;
  reason: string | null;
  business_justification: string | null;
  required_date: string | null;
  modality: string | null;
  country: string | null;
  basic_profile: string | null;
  priority: string | null;
  status: RequisitionStatus;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewer_name?: string | null;
  reviewed_at: Date | null;
  review_comments: string | null;
  created_at: Date;
  total_count?: string | number;
}

export interface RequisitionListItem {
  id: string;
  code: string;
  type: RequisitionType;
  positionLabel: string | null;
  area: string;
  priority: string | null;
  status: RequisitionStatus;
  requesterName: string | null;
  createdAt: string;
  submittedAt: string | null;
}

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export function toListItem(r: RequisitionRow): RequisitionListItem {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    positionLabel: r.position_label ?? r.position_title,
    area: r.area,
    priority: r.priority,
    status: r.status,
    requesterName: r.requester_name ?? null,
    createdAt: iso(r.created_at) as string,
    submittedAt: iso(r.submitted_at),
  };
}

export interface RequisitionDetail extends RequisitionListItem {
  jobPositionId: string | null;
  jobPositionCode: string | null;
  positionTitle: string | null;
  reason: string | null;
  businessJustification: string | null;
  requiredDate: string | null;
  modality: string | null;
  country: string | null;
  basicProfile: string | null;
  reviewedBy: { id: string; name: string | null } | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  /** Nueva posición sin puesto en la Matriz: RRHH debe crearlo. */
  needsMatrixPosition: boolean;
}

/** Detalle con campos explícitos: ningún id de auditoría crudo ni la entidad completa. */
export function toDetail(r: RequisitionRow): RequisitionDetail {
  return {
    ...toListItem(r),
    jobPositionId: r.job_position_id,
    jobPositionCode: r.job_position_code ?? null,
    positionTitle: r.position_title,
    reason: r.reason,
    businessJustification: r.business_justification,
    requiredDate: r.required_date,
    modality: r.modality,
    country: r.country,
    basicProfile: r.basic_profile,
    reviewedBy: r.reviewed_by ? { id: r.reviewed_by, name: r.reviewer_name ?? null } : null,
    reviewedAt: iso(r.reviewed_at),
    reviewComments: r.review_comments,
    needsMatrixPosition: r.type === 'nueva_posicion' && !r.job_position_id,
  };
}

/** Columnas con la fecha requerida como texto y los datos de personas/puesto en un solo JOIN. */
export const REQUISITION_SELECT = `
  SELECT r.id, r.code, r.requester_employee_id, r.requester_user_id, e.full_name AS requester_name,
         r.type, r.job_position_id, jp.code AS job_position_code, ${POSITION_LABEL_SQL} AS position_label,
         r.position_title, r.area, r.reason, r.business_justification,
         to_char(r.required_date, 'YYYY-MM-DD') AS required_date,
         r.modality, r.country, r.basic_profile, r.priority, r.status, r.submitted_at,
         r.reviewed_by, u.name AS reviewer_name, r.reviewed_at, r.review_comments, r.created_at`;
export const REQUISITION_FROM = `
  FROM hr.job_requisitions r
  JOIN employees.employee_records e ON e.id = r.requester_employee_id
  LEFT JOIN hr.job_positions jp ON jp.id = r.job_position_id AND jp.deleted_at IS NULL
  LEFT JOIN auth.users u ON u.id = r.reviewed_by`;
