import { deriveFinancialInfo, fullMonthsElapsed } from './inventory.service';

const equipo = (over: Partial<Parameters<typeof deriveFinancialInfo>[0]> = {}) => ({
  financialProviderId: null,
  invoiceNumber: null,
  invoiceDate: null,
  purchaseValue: null,
  ...over,
});

describe('fullMonthsElapsed', () => {
  const now = new Date('2026-10-08T12:00:00');

  it('cuenta el mes solo al llegar al mismo día', () => {
    expect(fullMonthsElapsed('2026-09-08', now)).toBe(1);
    expect(fullMonthsElapsed('2026-09-09', now)).toBe(0);
  });

  it('una fecha futura cuenta 0, no negativo', () => {
    expect(fullMonthsElapsed('2026-12-01', now)).toBe(0);
  });

  it('fin de mes topa igual que addMonthsClamped', () => {
    // 31-ene → 28-feb ya es un mes completo.
    expect(fullMonthsElapsed('2027-01-31', new Date('2027-02-28T09:00:00'))).toBe(1);
  });
});

describe('deriveFinancialInfo', () => {
  const now = new Date('2026-10-08T12:00:00');

  it('sin fecha de factura no hay depreciación', () => {
    const r = deriveFinancialInfo(equipo({ purchaseValue: '36000.00' }), null, now);
    expect(r).toMatchObject({
      purchaseValue: 36000,
      depreciationEndDate: null,
      currentValue: null,
      depreciationPercentage: 0,
      isFullyDepreciated: false,
    });
  });

  it('a mitad de vida: valor/36 por mes completo transcurrido', () => {
    // 2025-04-08 → 2026-10-08 = 18 meses.
    const r = deriveFinancialInfo(
      equipo({ invoiceDate: '2025-04-08', purchaseValue: '36000.00' }),
      null,
      now,
    );
    expect(r.monthlyDepreciation).toBe(1000);
    expect(r.currentValue).toBe(18000);
    expect(r.depreciationPercentage).toBe(50);
    expect(r.depreciationEndDate).toBe('2028-04-08');
    expect(r.isFullyDepreciated).toBe(false);
  });

  it('a los 36 meses queda en $0 y al 100%, aunque pasen más', () => {
    const r = deriveFinancialInfo(
      equipo({ invoiceDate: '2022-01-10', purchaseValue: 15000 }),
      null,
      now,
    );
    expect(r.currentValue).toBe(0);
    expect(r.depreciationPercentage).toBe(100);
    expect(r.isFullyDepreciated).toBe(true);
  });

  it('sin valor calcula fechas y avance pero no montos', () => {
    const r = deriveFinancialInfo(equipo({ invoiceDate: '2025-04-08' }), null, now);
    expect(r.monthlyDepreciation).toBeNull();
    expect(r.currentValue).toBeNull();
    expect(r.depreciationPercentage).toBe(50);
  });

  it('no deja residuo de centavos por redondear la mensualidad', () => {
    // 15000/36 = 416.666…; con 416.67 × 35 quedaría 416.55 en vez de 416.67.
    const r = deriveFinancialInfo(
      equipo({ invoiceDate: '2023-11-08', purchaseValue: 15000 }),
      null,
      now,
    );
    expect(r.monthlyDepreciation).toBe(416.67);
    expect(r.currentValue).toBe(416.67);
  });

  it('el nombre del proveedor solo aparece si hay proveedor', () => {
    expect(deriveFinancialInfo(equipo(), 'Ignorado', now).providerName).toBeNull();
    expect(
      deriveFinancialInfo(equipo({ financialProviderId: 'v1' }), 'CompuMundo', now).providerName,
    ).toBe('CompuMundo');
  });
});
