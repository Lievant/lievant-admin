/**
 * Valores del catálogo de herramientas.
 *
 * Viven como constantes y no como tablas de `catalogs`: son el dominio cerrado
 * que la migración documenta en los comentarios de columna, no listas que el
 * usuario administre desde la UI. Si algún día se vuelven editables, el cambio
 * es mover estos arreglos a una tabla, no reescribir los DTO.
 */

export const TOOL_CATEGORIES = [
  'Correo',
  'Suite Ofimática',
  'CRM',
  'Firma Digital',
  'Inteligencia Artificial',
  'Gestión de Proyectos',
  'Comunicación',
  'Diseño',
  'Seguridad',
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

export const TOOL_ASSIGNMENT_STATUSES = ['activa', 'pendiente_aprobacion', 'revocada'] as const;

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
