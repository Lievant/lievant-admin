import { Injectable } from '@nestjs/common';
import { PacingStatus } from './entities/pacing-snapshot.entity';

export interface PacingInputs {
  budgetAmount: number | null;
  spendAccumulated: number;
  daysInMonth: number;
  daysElapsed: number; // días transcurridos incluyendo hoy
  daysRemaining: number; // días restantes del mes (sin contar hoy)
}

export interface PacingResult {
  budgetAmount: number | null;
  spendAccumulated: number;
  spendExpected: number | null;
  spendDailyAvg: number;
  spendDailyIdeal: number | null;
  spendDailyRemaining: number | null;
  pctConsumed: number | null;
  pacingPct: number | null;
  projectedClose: number | null;
  daysToExhaustion: number | null;
  daysRemaining: number;
  status: PacingStatus;
}

/**
 * Servicio de cálculo de pacing. Umbrales hardcodeados inicialmente:
 *  - green:  pacing <= 105% Y agotamiento >= cierre de mes
 *  - yellow: pacing 105-115% O agotamiento en 8-14 días
 *  - red:    pacing > 115% O consumo >= 100% O agotamiento <= 7 días
 *  - gray:   sin presupuesto o sin datos
 */
@Injectable()
export class MediaPacingService {
  // Umbrales configurables (por ahora constantes)
  readonly PACING_GREEN_MAX = 105;
  readonly PACING_YELLOW_MAX = 115;
  readonly EXHAUSTION_RED_DAYS = 7;
  readonly EXHAUSTION_YELLOW_DAYS = 14;

  /**
   * Determina el color del semáforo a partir de los KPIs calculados.
   */
  calculatePacingStatus(
    pctConsumed: number | null,
    pacingPct: number | null,
    daysToExhaustion: number | null,
  ): PacingStatus {
    // Sin datos suficientes → gris
    if (pacingPct === null || pctConsumed === null) {
      return 'gray';
    }

    // Rojo: pacing sobregirado, presupuesto agotado, o agotamiento inminente
    if (
      pacingPct > this.PACING_YELLOW_MAX ||
      pctConsumed >= 100 ||
      (daysToExhaustion !== null && daysToExhaustion <= this.EXHAUSTION_RED_DAYS)
    ) {
      return 'red';
    }

    // Amarillo: pacing elevado o agotamiento próximo (8-14 días)
    if (
      pacingPct > this.PACING_GREEN_MAX ||
      (daysToExhaustion !== null &&
        daysToExhaustion > this.EXHAUSTION_RED_DAYS &&
        daysToExhaustion <= this.EXHAUSTION_YELLOW_DAYS)
    ) {
      return 'yellow';
    }

    // Verde: dentro de lo esperado
    return 'green';
  }

  /**
   * Calcula todos los KPIs de pacing dado el presupuesto, el gasto acumulado
   * y la posición dentro del mes.
   */
  computePacing(inputs: PacingInputs): PacingResult {
    const { budgetAmount, spendAccumulated, daysInMonth, daysElapsed, daysRemaining } = inputs;

    const spendDailyAvg = daysElapsed > 0 ? spendAccumulated / daysElapsed : 0;

    if (budgetAmount === null || budgetAmount <= 0) {
      return {
        budgetAmount,
        spendAccumulated,
        spendExpected: null,
        spendDailyAvg: round2(spendDailyAvg),
        spendDailyIdeal: null,
        spendDailyRemaining: null,
        pctConsumed: null,
        pacingPct: null,
        projectedClose: null,
        daysToExhaustion: null,
        daysRemaining,
        status: 'gray',
      };
    }

    const spendDailyIdeal = budgetAmount / daysInMonth;
    const spendExpected = spendDailyIdeal * daysElapsed;
    const remainingBudget = budgetAmount - spendAccumulated;
    const spendDailyRemaining = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    const pctConsumed = (spendAccumulated / budgetAmount) * 100;
    const pacingPct = spendExpected > 0 ? (spendAccumulated / spendExpected) * 100 : 0;

    // Proyección de cierre: promedio diario extrapolado al total de días del mes
    const projectedClose = spendDailyAvg * daysInMonth;

    // Días a agotamiento: cuánto durará el presupuesto restante al ritmo actual
    let daysToExhaustion: number | null = null;
    if (spendDailyAvg > 0) {
      if (remainingBudget <= 0) {
        daysToExhaustion = 0;
      } else {
        daysToExhaustion = Math.floor(remainingBudget / spendDailyAvg);
      }
    }

    const status = this.calculatePacingStatus(pctConsumed, pacingPct, daysToExhaustion);

    return {
      budgetAmount,
      spendAccumulated: round2(spendAccumulated),
      spendExpected: round2(spendExpected),
      spendDailyAvg: round2(spendDailyAvg),
      spendDailyIdeal: round2(spendDailyIdeal),
      spendDailyRemaining: round2(spendDailyRemaining),
      pctConsumed: round2(pctConsumed),
      pacingPct: round2(pacingPct),
      projectedClose: round2(projectedClose),
      daysToExhaustion,
      daysRemaining,
      status,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
