/**
 * Fórmulas de la Matriz de Riesgos (TIC-RE-08). Fuente única de verdad: el
 * servicio las aplica siempre al guardar y el API ignora cualquier valor
 * calculado que mande el cliente. El frontend tiene un espejo para la vista
 * previa en vivo; `risk-calculation.parity.spec.ts` los compara.
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
export const CONTROL_EFFICACIES = [0.1, 0.2, 0.3, 0.4, 0.5] as const;
export const ACTION_STATUSES = [
  'No iniciado',
  'Pendiente',
  'Iniciado',
  'En proceso',
  'Resuelto',
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type RiskLevel = 'verde' | 'amarillo' | 'rojo';

/** Límites del semáforo del riesgo residual: verde ≤ 20, amarillo ≤ 40, rojo > 40. */
export const GREEN_MAX = 20;
export const YELLOW_MAX = 40;

/** Vulnerabilidad × Severidad × Probabilidad (1 a 125). */
export function calculateRiskValue(
  vulnerability: number,
  severity: number,
  probability: number,
): number {
  return vulnerability * severity * probability;
}

/**
 * Valor × eficacia, redondeado a 2 decimales. La eficacia tiene un decimal, así
 * que se multiplica por décimas enteras: 48 × 0.3 en coma flotante da
 * 14.399999999999999 y aquí da 14.4.
 */
export function calculateResidualRisk(riskValue: number, efficacy: number): number {
  const tenths = Math.round(efficacy * 10);
  return Number(((riskValue * tenths) / 10).toFixed(2));
}

export function riskLevel(residualRisk: number): RiskLevel {
  if (residualRisk <= GREEN_MAX) return 'verde';
  if (residualRisk <= YELLOW_MAX) return 'amarillo';
  return 'rojo';
}

export function calculateRisk(
  vulnerability: number,
  severity: number,
  probability: number,
  efficacy: number,
): { riskValue: number; residualRisk: number; level: RiskLevel } {
  const riskValue = calculateRiskValue(vulnerability, severity, probability);
  const residualRisk = calculateResidualRisk(riskValue, efficacy);
  return { riskValue, residualRisk, level: riskLevel(residualRisk) };
}
