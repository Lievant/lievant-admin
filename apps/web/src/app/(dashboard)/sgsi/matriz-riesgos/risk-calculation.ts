/**
 * Espejo de apps/api/src/modules/risks/risk-calculation.ts, solo para la vista
 * previa en vivo del formulario. La fuente de verdad es la del API (que recalcula
 * siempre al guardar); `risk-calculation.parity.spec.ts`, en el API, compara
 * ambas en toda la rejilla de entradas. Si cambias una, cambia la otra.
 */

export type RiskLevel = 'verde' | 'amarillo' | 'rojo';

export const GREEN_MAX = 20;
export const YELLOW_MAX = 40;

export function calculateRiskValue(vulnerability: number, severity: number, probability: number): number {
  return vulnerability * severity * probability;
}

/** Con décimas enteras para evitar 48 × 0.3 = 14.399999999999999. */
export function calculateResidualRisk(riskValue: number, efficacy: number): number {
  const tenths = Math.round(efficacy * 10);
  return Number(((riskValue * tenths) / 10).toFixed(2));
}

export function riskLevel(residualRisk: number): RiskLevel {
  if (residualRisk <= GREEN_MAX) return 'verde';
  if (residualRisk <= YELLOW_MAX) return 'amarillo';
  return 'rojo';
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
};

export const LEVEL_CLASS: Record<RiskLevel, string> = {
  verde: 'bg-emerald-100 text-emerald-700',
  amarillo: 'bg-amber-100 text-amber-700',
  rojo: 'bg-rose-100 text-rose-700',
};

export const LEVEL_DESCRIPTION: Record<RiskLevel, string> = {
  verde: 'Riesgo bajo: monitoreo del riesgo',
  amarillo: 'Riesgo medio: monitorear y/o evaluar toma de acciones',
  rojo: 'Riesgo alto: se deben tomar acciones (abrir plan de acción)',
};
