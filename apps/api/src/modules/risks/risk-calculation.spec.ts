import {
  calculateResidualRisk,
  calculateRisk,
  calculateRiskValue,
  riskLevel,
} from './risk-calculation';

describe('calculateRisk con los 7 riesgos de ejemplo de TIC-RE-08', () => {
  // [vulnerabilidad, severidad, probabilidad, eficacia, valor, residual, semáforo]
  it.each([
    ['COR', 4, 4, 3, 0.3, 48, 14.4, 'verde'],
    ['LAPZO', 4, 4, 3, 0.3, 48, 14.4, 'verde'],
    ['SmartDashboard', 2, 2, 2, 0.3, 8, 2.4, 'verde'],
    ['Bases de datos', 5, 5, 2, 0.5, 50, 25, 'amarillo'],
    ['M365', 4, 5, 5, 0.3, 100, 30, 'amarillo'],
    ['Información de clientes', 4, 3, 5, 0.3, 60, 18, 'verde'],
    ['Información de campañas', 4, 4, 4, 0.5, 64, 32, 'amarillo'],
  ] as const)('%s', (_n, v, s, p, e, valor, residual, nivel) => {
    expect(calculateRisk(v, s, p, e)).toEqual({ riskValue: valor, residualRisk: residual, level: nivel });
  });
});

describe('límites y redondeo', () => {
  it('mínimo: 1·1·1·0.1 = 0.1', () => {
    expect(calculateRisk(1, 1, 1, 0.1)).toMatchObject({ riskValue: 1, residualRisk: 0.1 });
  });

  it('máximo: 5·5·5·0.5 = 62.5', () => {
    expect(calculateRisk(5, 5, 5, 0.5)).toMatchObject({ riskValue: 125, residualRisk: 62.5, level: 'rojo' });
  });

  it('4·4·3·0.3 = 14.4 y no 14.399999999999999', () => {
    expect(48 * 0.3).not.toBe(14.4); // el problema de coma flotante que se evita
    expect(calculateResidualRisk(calculateRiskValue(4, 4, 3), 0.3)).toBe(14.4);
  });

  it('todos los residuales posibles tienen como máximo 2 decimales exactos', () => {
    for (let valor = 1; valor <= 125; valor++) {
      for (const e of [0.1, 0.2, 0.3, 0.4, 0.5]) {
        const r = calculateResidualRisk(valor, e);
        expect(Number(r.toFixed(2))).toBe(r);
      }
    }
  });
});

describe('semáforo del riesgo residual (verde ≤ 20, amarillo ≤ 40, rojo > 40)', () => {
  it.each([
    [0.1, 'verde'],
    [20, 'verde'],
    [20.01, 'amarillo'],
    [40, 'amarillo'],
    [40.01, 'rojo'],
    [62.5, 'rojo'],
  ] as const)('%s es %s', (valor, nivel) => {
    expect(riskLevel(valor)).toBe(nivel);
  });
});
