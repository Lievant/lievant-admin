import { addMonthsClamped, deriveMaintenance } from './inventory.service';

describe('addMonthsClamped (RN-8)', () => {
  it('topa al último día del mes destino en vez de desbordar', () => {
    // El caso de la spec: 2026-08-31 + 6 meses → 2027-02-28, no 2027-03-03.
    expect(addMonthsClamped('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('conserva el día cuando el mes destino lo permite', () => {
    // Criterio de aceptación 5: 2026-09-29 → 2027-03-29.
    expect(addMonthsClamped('2026-09-29', 6)).toBe('2027-03-29');
  });

  it('maneja el año bisiesto', () => {
    // 2023-08-29 + 6 = 2024-02-29 (2024 es bisiesto).
    expect(addMonthsClamped('2023-08-29', 6)).toBe('2024-02-29');
  });

  it('cruza el año correctamente', () => {
    expect(addMonthsClamped('2026-10-15', 6)).toBe('2027-04-15');
  });
});

describe('deriveMaintenance (D2, D4, semáforo)', () => {
  const now = new Date('2026-09-29T12:00:00');

  it('sin ningún preventivo → sin_mantenimiento, nunca vencido (D4)', () => {
    expect(deriveMaintenance([], now)).toEqual({
      lastMaintenanceDate: null,
      nextMaintenanceDate: null,
      maintenanceStatus: 'sin_mantenimiento',
    });
  });

  it('un correctivo no cuenta ni mueve la fecha (D2, criterio 9)', () => {
    const res = deriveMaintenance([{ maintenanceDate: '2026-09-01', maintenanceType: 'Correctivo' }], now);
    expect(res.maintenanceStatus).toBe('sin_mantenimiento');
    expect(res.nextMaintenanceDate).toBeNull();
  });

  it('preventivo reciente → al_dia con próximo a +6 meses (criterio 5)', () => {
    const res = deriveMaintenance([{ maintenanceDate: '2026-09-29', maintenanceType: 'Preventivo' }], now);
    expect(res.nextMaintenanceDate).toBe('2027-03-29');
    expect(res.maintenanceStatus).toBe('al_dia');
  });

  it('preventivo de hace más de 6 meses → vencido (criterio 6)', () => {
    const res = deriveMaintenance([{ maintenanceDate: '2026-01-01', maintenanceType: 'Preventivo' }], now);
    expect(res.nextMaintenanceDate).toBe('2026-07-01');
    expect(res.maintenanceStatus).toBe('vencido');
  });

  it('próximo dentro de 30 días → por_vencer (criterio 7)', () => {
    // último preventivo 2026-04-10 → próximo 2026-10-10, faltan 11 días desde 2026-09-29.
    const res = deriveMaintenance([{ maintenanceDate: '2026-04-10', maintenanceType: 'Preventivo' }], now);
    expect(res.nextMaintenanceDate).toBe('2026-10-10');
    expect(res.maintenanceStatus).toBe('por_vencer');
  });

  it('toma el preventivo más reciente e ignora los correctivos posteriores', () => {
    const res = deriveMaintenance(
      [
        { maintenanceDate: '2026-03-01', maintenanceType: 'Preventivo' },
        { maintenanceDate: '2026-09-20', maintenanceType: 'Correctivo' },
        { maintenanceDate: '2026-05-15', maintenanceType: 'Preventivo' },
      ],
      now,
    );
    // último preventivo = 2026-05-15 → 2026-11-15.
    expect(res.lastMaintenanceDate).toBe('2026-05-15');
    expect(res.nextMaintenanceDate).toBe('2026-11-15');
  });

  it('caso de fin de mes de extremo a extremo (criterio 15)', () => {
    const res = deriveMaintenance([{ maintenanceDate: '2026-08-31', maintenanceType: 'Preventivo' }], now);
    expect(res.nextMaintenanceDate).toBe('2027-02-28');
  });
});
