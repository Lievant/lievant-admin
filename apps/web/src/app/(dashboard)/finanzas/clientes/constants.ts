import type { ClientSegment, ClientStatus, ContactType, DocumentStatus } from '@/lib/api';

export const CLIENT_STATUSES: ClientStatus[] = ['active', 'paused', 'lost'];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Activo',
  paused: 'Pausado',
  lost: 'Perdido',
};

export const CLIENT_STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  active: 'bg-green-50 text-green-600',
  paused: 'bg-amber-50 text-amber-600',
  lost: 'bg-red-50 text-red-600',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: 'Cargado',
  pending: 'Pendiente',
  missing: 'Faltante',
};

export const DOCUMENT_STATUS_BADGE_STYLES: Record<DocumentStatus, string> = {
  uploaded: 'bg-green-50 text-green-600',
  pending: 'bg-amber-50 text-amber-600',
  missing: 'bg-red-50 text-red-600',
};

export const DOCUMENT_TYPES = [
  'contrato',
  'rfc',
  'poder_notarial',
  'nda',
  'acta_constitutiva',
  'adendum',
  'otro',
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contrato: 'Contrato',
  rfc: 'RFC',
  poder_notarial: 'Poder notarial',
  nda: 'NDA',
  acta_constitutiva: 'Acta constitutiva',
  adendum: 'Adéndum',
  otro: 'Otro',
};

export const CONTACT_TYPES: ContactType[] = [
  'financial',
  'administrative',
  'commercial',
  'operational',
  'legal',
  'direction',
];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  financial: 'Financiero',
  administrative: 'Administrativo',
  commercial: 'Comercial',
  operational: 'Operativo',
  legal: 'Legal',
  direction: 'Dirección',
};

export const CONTACT_TYPE_BADGE_STYLES: Record<ContactType, string> = {
  financial: 'bg-emerald-50 text-emerald-600',
  administrative: 'bg-slate-100 text-slate-600',
  commercial: 'bg-blue-50 text-blue-600',
  operational: 'bg-purple-50 text-purple-600',
  legal: 'bg-amber-50 text-amber-600',
  direction: 'bg-terracota/10 text-terracota-dark',
};

export const CLIENT_SEGMENTS: ClientSegment[] = ['A', 'B', 'C'];

export const CLIENT_SEGMENT_LABELS: Record<ClientSegment, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
};

export const CLIENT_SEGMENT_BADGE_STYLES: Record<ClientSegment, string> = {
  A: 'bg-green-50 text-green-600',
  B: 'bg-amber-50 text-amber-600',
  C: 'bg-red-50 text-red-600',
};

export const SAT_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'PUE', label: 'PUE - Pago en una sola exhibición' },
  { value: 'PPD', label: 'PPD - Pago en parcialidades o diferido' },
];

export const SAT_PAYMENT_FORMS: { value: string; label: string }[] = [
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque nominativo' },
  { value: '03', label: '03 - Transferencia electrónica' },
  { value: '04', label: '04 - Tarjeta de crédito' },
  { value: '28', label: '28 - Tarjeta de débito' },
  { value: '99', label: '99 - Por definir' },
];

export const SAT_CFDI_USES: { value: string; label: string }[] = [
  { value: 'G01', label: 'G01 - Adquisición de mercancías' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'I01', label: 'I01 - Construcciones' },
  { value: 'P01', label: 'P01 - Por definir' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
];

export const SAT_TAX_REGIMES: { value: string; label: string }[] = [
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '612', label: '612 - Personas Físicas con Actividades Empresariales' },
  { value: '621', label: '621 - Régimen de Incorporación Fiscal' },
  { value: '626', label: '626 - Régimen Simplificado de Confianza' },
];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

export function clientDisplayName(client: {
  group: { name: string } | null;
  primaryCompany: { name: string };
}): string {
  return client.group?.name ?? client.primaryCompany.name;
}

export function clientTypeLabel(client: { group: { name: string } | null }): string {
  return client.group ? 'Grupo económico' : 'Empresa directa';
}
