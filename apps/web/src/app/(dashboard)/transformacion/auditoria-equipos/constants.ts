import type { EquipmentAuditMaintenance, EquipmentAuditStatus } from '@/lib/api';

export const AUDIT_STATUS_LABEL: Record<EquipmentAuditStatus, string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  con_observaciones: 'Con observaciones',
};

export const AUDIT_STATUS_STYLE: Record<EquipmentAuditStatus, string> = {
  en_progreso: 'bg-blue-50 text-blue-700',
  completada: 'bg-green-50 text-green-700',
  con_observaciones: 'bg-amber-50 text-amber-700',
};

/** `aa-bb-cc…`, `aabb.ccdd.eeff` o 12 dígitos → `AA:BB:CC:DD:EE:FF`. Vacío → ''. Inválida → null. */
export function normalizeMac(value: string): string | null {
  const raw = value.trim();
  if (!raw) return '';
  const hex = raw.replace(/[:\-.\s]/g, '');
  if (!/^[0-9a-fA-F]{12}$/.test(hex)) return null;
  return hex.toUpperCase().match(/.{2}/g)!.join(':');
}

type MaintenanceCheckKey = Exclude<keyof EquipmentAuditMaintenance, 'maintenanceSharedAccounts' | 'maintenanceNotes'>;

export const PHYSICAL_CHECKS: { key: MaintenanceCheckKey; label: string }[] = [
  { key: 'maintenanceBlower', label: 'Se pasó soplador' },
  { key: 'maintenanceKeyboardCleaning', label: 'Limpieza de teclado' },
  { key: 'maintenanceScreenCleaning', label: 'Limpieza de pantalla' },
];

export const LOGICAL_CHECKS: { key: MaintenanceCheckKey; label: string }[] = [
  { key: 'maintenanceLogicalUnit', label: 'Mantenimiento unidad lógica' },
  { key: 'maintenanceDriversUpdated', label: 'Actualización de drivers' },
  { key: 'maintenanceAntivirusRemoved', label: 'Antivirus revisado/quitado' },
  { key: 'maintenanceCacheCleaned', label: 'Caché de Windows limpiada' },
  { key: 'maintenanceBitlockerActive', label: 'BitLocker activo' },
  { key: 'maintenanceBrowserPasswordsCleared', label: 'Passwords del navegador borrados' },
  { key: 'maintenanceOnedriveSynced', label: 'OneDrive sincronizado' },
  { key: 'maintenanceOnedriveBackup', label: 'Backup de Documentos y Descargas en OneDrive' },
  { key: 'maintenanceNoCRootFolders', label: 'Sin carpetas en raíz de C:\\' },
];

export const SURVEY_QUESTIONS = [
  { score: 'surveyEquipmentScore', notes: 'surveyEquipmentNotes', label: 'Equipos e infraestructura tecnológica' },
  { score: 'surveyItServiceScore', notes: 'surveyItServiceNotes', label: 'Servicio de TI y atención de tickets' },
  { score: 'surveyPlatformScore', notes: 'surveyPlatformNotes', label: 'Plataforma Lievant Admin' },
] as const;

/**
 * Fecha de calendario (AAAA-MM-DD) tal cual, sin pasar por `new Date()`: esa
 * conversión la toma como UTC y en México muestra el día anterior.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

/** Hoy en la Ciudad de México, como AAAA-MM-DD. */
export function todayInMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export const INPUT_CLASS =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-slate-50 disabled:text-slate-500';
export const LABEL_CLASS = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

/** Mensaje de un cuerpo de error del API (string o arreglo de validaciones). */
export async function errorMessageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // el cuerpo no es JSON
  }
  return fallback;
}
