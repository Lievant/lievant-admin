import {
  calculateResidualRisk as webResidual,
  calculateRiskValue as webValue,
  riskLevel as webLevel,
  // El espejo del frontend, solo para la vista previa del formulario.
} from '../../../../web/src/app/(dashboard)/sgsi/matriz-riesgos/risk-calculation';
import {
  CONTROL_EFFICACIES,
  calculateResidualRisk,
  calculateRiskValue,
  riskLevel,
} from './risk-calculation';

describe('Paridad entre la fórmula del API y el espejo del frontend', () => {
  it('coinciden en toda la rejilla de entradas (1-5 × 1-5 × 1-5 × eficacias)', () => {
    let casos = 0;
    for (let v = 1; v <= 5; v++) {
      for (let s = 1; s <= 5; s++) {
        for (let p = 1; p <= 5; p++) {
          const valor = calculateRiskValue(v, s, p);
          expect(webValue(v, s, p)).toBe(valor);
          for (const e of CONTROL_EFFICACIES) {
            const residual = calculateResidualRisk(valor, e);
            expect(webResidual(valor, e)).toBe(residual);
            expect(webLevel(residual)).toBe(riskLevel(residual));
            casos++;
          }
        }
      }
    }
    expect(casos).toBe(625);
  });

  it('coinciden en los bordes del semáforo', () => {
    for (const r of [0.1, 20, 20.01, 40, 40.01, 62.5]) {
      expect(webLevel(r)).toBe(riskLevel(r));
    }
  });
});
