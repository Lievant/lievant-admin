export type RequisitionType = 'nueva_posicion' | 'reemplazo' | 'temporal';
export type RequisitionStatus = 'borrador' | 'enviada' | 'aprobada' | 'rechazada';

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
  needsMatrixPosition: boolean;
}

export interface RequisitionPage {
  data: RequisitionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const TYPE_OPTIONS: { value: RequisitionType; label: string }[] = [
  { value: 'nueva_posicion', label: 'Nueva Posición' },
  { value: 'reemplazo', label: 'Reemplazo' },
  { value: 'temporal', label: 'Temporal' },
];
export const MODALITY_OPTIONS = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'remoto', label: 'Remoto' },
];
export const COUNTRY_OPTIONS = [
  { value: 'mexico', label: 'México' },
  { value: 'colombia', label: 'Colombia' },
  { value: 'eeuu', label: 'EE.UU.' },
];
export const PRIORITY_OPTIONS = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

export const STATUS_LABELS: Record<RequisitionStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

export const STATUS_BADGE: Record<RequisitionStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-amber-50 text-amber-700',
  aprobada: 'bg-emerald-50 text-emerald-700',
  rechazada: 'bg-red-50 text-red-700',
};

export const PRIORITY_BADGE: Record<string, string> = {
  alta: 'bg-red-50 text-red-700',
  media: 'bg-amber-50 text-amber-700',
  baja: 'bg-slate-100 text-slate-600',
};

const labelOf = (opts: { value: string; label: string }[], v: string | null): string => opts.find((o) => o.value === v)?.label ?? '—';
export const typeLabel = (v: string | null) => labelOf(TYPE_OPTIONS, v);
export const modalityLabel = (v: string | null) => labelOf(MODALITY_OPTIONS, v);
export const countryLabel = (v: string | null) => labelOf(COUNTRY_OPTIONS, v);
export const priorityLabel = (v: string | null) => labelOf(PRIORITY_OPTIONS, v);

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sin pasar por Date (evita el corrimiento de zona). */
export function formatDay(day: string | null): string {
  if (!day) return '—';
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** ISO → 'dd/mm/aaaa hh:mm' en America/Mexico_City. */
export function formatDateTimeMx(iso: string | null): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

/** Hoy en la oficina ('AAAA-MM-DD'), para el mínimo del campo de fecha. */
export function todayMx(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export const OTHER_POSITION = '__otro__';

export interface FormValues {
  type: string;
  positionChoice: string; // id de la Matriz u OTHER_POSITION
  positionTitle: string;
  area: string;
  reason: string;
  businessJustification: string;
  requiredDate: string;
  modality: string;
  country: string;
  basicProfile: string;
  priority: string;
}

/** Los mismos obligatorios que exige el servidor al enviar. Devuelve el primer error. */
export function validateForSubmit(v: FormValues, today: string): string | null {
  if (!v.type) return 'El tipo de solicitud es obligatorio.';
  if (!v.positionChoice) return 'Elige un puesto o "Otro (Puesto Nuevo)".';
  if (v.positionChoice === OTHER_POSITION && !v.positionTitle.trim()) return 'Escribe el nombre del puesto nuevo.';
  if (!v.area.trim()) return 'El área es obligatoria.';
  if (!v.reason.trim()) return 'El motivo es obligatorio.';
  if (!v.businessJustification.trim()) return 'La justificación de negocio es obligatoria.';
  if (!v.requiredDate) return 'La fecha requerida es obligatoria.';
  if (v.requiredDate < today) return 'La fecha requerida no puede ser anterior a hoy.';
  if (!v.modality) return 'La modalidad es obligatoria.';
  if (!v.country) return 'El país es obligatorio.';
  if (!v.basicProfile.trim()) return 'El perfil básico es obligatorio.';
  if (!v.priority) return 'La prioridad es obligatoria.';
  return null;
}

/** Cuerpo para guardar: con puesto de la Matriz el texto libre no se envía. */
export function toPayload(v: FormValues): Record<string, unknown> {
  const matrix = v.positionChoice && v.positionChoice !== OTHER_POSITION ? v.positionChoice : null;
  return {
    type: v.type,
    jobPositionId: matrix,
    positionTitle: matrix ? null : v.positionTitle.trim() || null,
    area: v.area.trim() || null,
    reason: v.reason.trim() || null,
    businessJustification: v.businessJustification.trim() || null,
    requiredDate: v.requiredDate || null,
    modality: v.modality || null,
    country: v.country || null,
    basicProfile: v.basicProfile.trim() || null,
    priority: v.priority || null,
  };
}

/** Valores iniciales del formulario a partir de un borrador (o vacíos con el área del líder). */
export function toFormValues(d: RequisitionDetail | null, defaultArea: string): FormValues {
  if (!d) {
    return { type: 'nueva_posicion', positionChoice: '', positionTitle: '', area: defaultArea, reason: '', businessJustification: '', requiredDate: '', modality: '', country: '', basicProfile: '', priority: '' };
  }
  return {
    type: d.type,
    positionChoice: d.jobPositionId ?? (d.positionTitle ? OTHER_POSITION : ''),
    positionTitle: d.positionTitle ?? '',
    area: d.area,
    reason: d.reason ?? '',
    businessJustification: d.businessJustification ?? '',
    requiredDate: d.requiredDate ?? '',
    modality: d.modality ?? '',
    country: d.country ?? '',
    basicProfile: d.basicProfile ?? '',
    priority: d.priority ?? '',
  };
}

/** Mensaje de un error del API: arreglo de mensajes o texto. */
export async function readApiError(res: Response, fallback: string): Promise<{ message: string; code?: string }> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[]; code?: string } | null;
  const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
  return { message: message || (res.status === 403 ? 'No tienes permiso para esta acción.' : fallback), ...(body?.code ? { code: body.code } : {}) };
}
