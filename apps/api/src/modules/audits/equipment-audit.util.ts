/**
 * Reglas puras de la Auditoría de Equipos (TIC-RE-18), sin acceso a BD para
 * poder probarlas aisladas. El front repite `isMacEligible` /
 * `isMaintenanceEligible` con los mismos tipos.
 */

export const AUDIT_STATUSES = ['en_progreso', 'completada', 'con_observaciones'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

/** Quien atiende el ticket de mantenimiento y recibe el aviso de TI. */
export const AUDIT_MAINTENANCE_ASSIGNEE_EMAIL = 'daniel.ortiz@lievant.com';
/** Responsable de TD: recibe el aviso de cada auditoría completada. */
export const AUDIT_TD_OWNER_EMAIL = 'paulo@lievant.com';
export const AUDIT_TICKET_CATEGORY = 'equipos';
export const AUDIT_TICKET_SUBCATEGORY = 'Mantenimiento preventivo';

/** Estado que toma en el inventario un equipo desasignado por no estar presente. */
export const NOT_PRESENT_EQUIPMENT_STATUS = 'Sin Verificar';

/** `inventory.equipment.equipment_type` guarda nombres visibles ("PC Escritorio", "Celular "). */
function normalizeType(type: string | null | undefined): string {
  return (type ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const MAC_TYPES = new Set(['laptop', 'pc', 'pc escritorio', 'celular', 'smartphone']);
const MAINTENANCE_TYPES = new Set(['laptop', 'pc', 'pc escritorio', 'monitor', 'pantalla']);

/** Laptops, PCs y celulares llevan MAC. */
export function isMacEligible(type: string | null | undefined): boolean {
  return MAC_TYPES.has(normalizeType(type));
}

/** El mantenimiento preventivo solo aplica a laptops, PCs y monitores. */
export function isMaintenanceEligible(type: string | null | undefined): boolean {
  return MAINTENANCE_TYPES.has(normalizeType(type));
}

export function formatAuditCode(n: number | string): string {
  return `AUD-${String(n).padStart(6, '0')}`;
}

/**
 * Acepta `aa:bb:cc:dd:ee:ff`, `AA-BB-…`, `aabb.ccdd.eeff` o los 12 dígitos
 * seguidos, y devuelve `AA:BB:CC:DD:EE:FF`. Vacío → null. Inválida → undefined.
 */
export function normalizeMac(value: string | null | undefined): string | null | undefined {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const hex = raw.replace(/[:\-.\s]/g, '');
  if (!/^[0-9a-fA-F]{12}$/.test(hex)) return undefined;
  return hex.toUpperCase().match(/.{2}/g)!.join(':');
}

/** Con un equipo ausente o una licencia faltante la auditoría cierra con observaciones. */
export function resolveFinalStatus(
  equipment: { physicallyPresent: boolean | null }[],
  licenses: { licensePresent: boolean | null }[],
): Exclude<AuditStatus, 'en_progreso'> {
  const issues =
    equipment.some((e) => e.physicallyPresent === false) || licenses.some((l) => l.licensePresent === false);
  return issues ? 'con_observaciones' : 'completada';
}

export const MAINTENANCE_CHECKS = [
  ['maintenance_blower', 'Se pasó soplador'],
  ['maintenance_keyboard_cleaning', 'Limpieza de teclado'],
  ['maintenance_screen_cleaning', 'Limpieza de pantalla'],
  ['maintenance_logical_unit', 'Mantenimiento de unidad lógica'],
  ['maintenance_drivers_updated', 'Actualización de drivers'],
  ['maintenance_antivirus_removed', 'Antivirus revisado/quitado'],
  ['maintenance_cache_cleaned', 'Caché de Windows limpiada'],
  ['maintenance_bitlocker_active', 'BitLocker activo'],
  ['maintenance_browser_passwords_cleared', 'Passwords del navegador borrados'],
  ['maintenance_onedrive_synced', 'OneDrive sincronizado'],
  ['maintenance_onedrive_backup', 'Backup de Documentos y Descargas en OneDrive'],
  ['maintenance_no_c_root_folders', 'Sin carpetas en raíz de C:\\'],
] as const;

export type MaintenanceColumn = (typeof MAINTENANCE_CHECKS)[number][0];

/** Descripción del ticket de mantenimiento: qué se hizo, qué no y lo observado. */
export function buildMaintenanceSummary(input: {
  auditCode: string;
  checks: Record<MaintenanceColumn, boolean | null>;
  sharedAccounts: string | null;
  notes: string | null;
  equipment: { code: string | null; label: string; present: boolean | null; unassigned: boolean }[];
}): string {
  const lines: string[] = [`Registrado desde la auditoría ${input.auditCode} (TIC-RE-18).`, ''];
  if (input.equipment.length > 0) {
    lines.push('Equipos auditados:');
    for (const e of input.equipment) {
      const state = e.present === false ? (e.unassigned ? 'no presente, desasignado' : 'no presente') : 'presente';
      lines.push(`- ${[e.code, e.label].filter(Boolean).join(' ')} (${state})`);
    }
    lines.push('');
  }
  lines.push('Mantenimiento preventivo:');
  for (const [column, label] of MAINTENANCE_CHECKS) {
    const v = input.checks[column];
    lines.push(`- [${v === true ? 'x' : ' '}] ${label}${v === false ? ' — no' : v == null ? ' — sin registrar' : ''}`);
  }
  if (input.sharedAccounts?.trim()) lines.push('', `Cuentas compartidas: ${input.sharedAccounts.trim()}`);
  if (input.notes?.trim()) lines.push('', `Observaciones: ${input.notes.trim()}`);
  return lines.join('\n');
}
