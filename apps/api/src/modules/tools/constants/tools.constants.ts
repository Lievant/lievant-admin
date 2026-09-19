/**
 * Valores del catálogo de herramientas.
 *
 * Viven como constantes y no como tablas de `catalogs`: son el dominio cerrado
 * que la migración documenta en los comentarios de columna, no listas que el
 * usuario administre desde la UI. Si algún día se vuelven editables, el cambio
 * es mover estos arreglos a una tabla, no reescribir los DTO.
 */

/**
 * Semilla histórica de categorías. La fuente de verdad es
 * catalogs.tool_categories (editable desde /admin/catalogos); esta lista solo
 * sirve de respaldo si el catálogo llegara vacío, para que el formulario no se
 * quede sin opciones.
 */
export const TOOL_CATEGORIES_FALLBACK = [
  'Correo',
  'Suite Ofimática',
  'CRM',
  'Firma Digital',
  'Inteligencia Artificial',
  'Gestión de Proyectos',
  'Comunicación',
  'Diseño',
  'Seguridad',
  'ERP / Contabilidad',
  'Otro',
] as const;

export const TOOL_CURRENCIES = ['MXN', 'USD'] as const;

export const TOOL_BILLING_PERIODS = ['mensual', 'trimestral', 'anual', 'unico'] as const;

export const TOOL_COST_CENTERS = ['TD', 'TI', 'Compartido'] as const;

export const TOOL_CONTRACT_STATUSES = [
  'activo',
  'en_negociacion',
  'por_cancelar',
  'cancelado',
] as const;

/** Estados de una asignación herramienta ↔ colaborador (tools.assignments). */
export const ASSIGNMENT_STATUSES = ['activo', 'revocado'] as const;

/** Umbrales de alerta por días sin uso. Los comparte el API con la UI. */
export const UNUSED_WARNING_DAYS = 30;
export const UNUSED_CRITICAL_DAYS = 60;

/**
 * Estados de una licencia individual. 'pendiente_aprobacion' existe porque una
 * herramienta puede marcarse con requires_approval: la licencia se captura,
 * pero no cuenta como activa ni suma al costo hasta que alguien la aprueba.
 */
export const LICENSE_STATUSES = [
  'activa',
  'pendiente_aprobacion',
  'suspendida',
  'cancelada',
] as const;

/**
 * Cuántas veces al año se paga cada periodo. 'unico' es 0: un pago único no
 * forma parte del gasto recurrente y sumarlo al costo anual lo inflaría cada
 * año que pase.
 */
export const BILLING_PERIODS_PER_YEAR: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  anual: 1,
  unico: 0,
};
