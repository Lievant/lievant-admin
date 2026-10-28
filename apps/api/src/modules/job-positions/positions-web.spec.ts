import {
  currentPeriod,
  currentSemesterMx,
  currentYearMx,
  formatDateTimeMx,
  formatPct,
  frequencyLabel,
  groupActivities,
  groupOkrs,
  hasAnyWeight,
  okrCode,
  okrPeriodLabel,
  okrsOfPeriod,
  plazasLabel,
  selectorToPeriod,
  type ActivityItem,
  makePeriod,
  parsePeriod,
  periodLabel,
  sumPeriodWeights,
  weightState,
  yearOptions,
  type OkrItem,
} from '../../../../web/src/app/(dashboard)/rrhh/matriz-puestos/positions-constants';

const okr = (period: string | null, weight: number | null, isActive = true, over: Partial<OkrItem> = {}): OkrItem => ({
  id: Math.random().toString(), jobPositionId: 'p', period, objectiveCode: null, krCode: null, objective: 'o', keyResult: 'k', weight, sortOrder: 0, isActive, ...over,
});

describe('Matriz de Puestos (web) · periodo', () => {
  it('arma y lee AAAA-S1 / AAAA-S2', () => {
    expect(makePeriod(2026, 2)).toBe('2026-S2');
    expect(parsePeriod('2026-S1')).toEqual({ year: 2026, semester: 1 });
    expect(parsePeriod('2026-S3')).toBeNull();
    expect(periodLabel('2026-S1')).toBe('Semestre 1 · 2026');
  });
  it('el periodo actual usa la hora de México (31 dic 23:30 en CDMX sigue siendo ese año y semestre 2)', () => {
    const lateDec = new Date('2027-01-01T05:30:00Z'); // 31/12/2026 23:30 en CDMX
    expect(currentYearMx(lateDec)).toBe(2026);
    expect(currentSemesterMx(lateDec)).toBe(2);
    expect(currentPeriod(new Date('2026-03-10T18:00:00Z'))).toBe('2026-S1');
    expect(currentPeriod(new Date('2026-07-01T18:00:00Z'))).toBe('2026-S2');
  });
  it('años del selector, sin repetir y del más reciente al más antiguo', () => {
    expect(yearOptions(2026, [2020, 2026])).toEqual([2027, 2026, 2025, 2024, 2020]);
  });
});

describe('Matriz de Puestos (web) · suma de pesos', () => {
  it('suma solo los OKRs activos del periodo', () => {
    const list = [okr('2026-S1', 50), okr('2026-S1', 30), okr('2026-S1', 20, false), okr('2026-S2', 99)];
    expect(sumPeriodWeights(list, '2026-S1')).toBe(80);
    expect(sumPeriodWeights(list, '2026-S2')).toBe(99);
    expect(sumPeriodWeights(list, '2025-S1')).toBe(0);
  });
  it('sin errores de coma flotante y los pesos nulos cuentan 0', () => {
    expect(sumPeriodWeights([okr('2026-S1', 33.33), okr('2026-S1', 33.33), okr('2026-S1', 33.34), okr('2026-S1', null)], '2026-S1')).toBe(100);
  });
  it('estado de la suma: vacío, incompleto, completo, pasado', () => {
    expect(weightState(0, 0)).toBe('empty');
    expect(weightState(80, 2)).toBe('incomplete');
    expect(weightState(100, 3)).toBe('complete');
    expect(weightState(100.01, 3)).toBe('over');
  });
  it('formato de porcentaje', () => {
    expect(formatPct(80)).toBe('80 %');
    expect(formatPct(33.5)).toBe('33.5 %');
    expect(formatPct(0.01)).toBe('0.01 %');
  });
});

describe('Matriz de Puestos (web) · formato', () => {
  it('fecha y hora en hora de México', () => {
    expect(formatDateTimeMx('2026-10-26T18:03:04.200Z')).toBe('26/10/2026 12:03');
    expect(formatDateTimeMx(null)).toBe('—');
  });
  it('etiquetas de frecuencia', () => {
    expect(frequencyLabel('trimestral')).toBe('Trimestral');
    expect(frequencyLabel(null)).toBe('—');
  });
});

describe('Matriz de Puestos (web) · plantilla, grupos y etiquetas (M6-B)', () => {
  it('la plantilla («base») es su propio grupo de periodo y no se mezcla con los semestres', () => {
    const okrs = [okr(null, 40), okr(null, 60), okr('2026-S1', 100), okr(null, 50, false)];
    expect(selectorToPeriod('base')).toBeNull();
    expect(selectorToPeriod('2026-S1')).toBe('2026-S1');
    expect(okrsOfPeriod(okrs, 'base')).toHaveLength(3);
    expect(sumPeriodWeights(okrs, 'base')).toBe(100);
    expect(sumPeriodWeights(okrs, '2026-S1')).toBe(100);
    expect(sumPeriodWeights(okrs, '2026-S2')).toBe(0);
  });
  it('sin pesos la suma no se muestra (—): hasAnyWeight es falso', () => {
    const okrs = [okr(null, null), okr(null, null)];
    expect(hasAnyWeight(okrs, 'base')).toBe(false);
    expect(hasAnyWeight([...okrs, okr(null, 10)], 'base')).toBe(true);
    expect(hasAnyWeight([okr(null, 10, false)], 'base')).toBe(false);
  });
  it('agrupa los OKRs por objetivo con sus resultados clave, en orden', () => {
    const rows = [
      okr(null, null, true, { objectiveCode: 'O1', krCode: 'KR1', objective: 'A' }),
      okr(null, null, true, { objectiveCode: 'O1', krCode: 'KR2', objective: 'A' }),
      okr(null, null, true, { objectiveCode: 'O2', krCode: 'KR1', objective: 'B' }),
    ];
    const g = groupOkrs(rows);
    expect(g.map((x) => [x.code, x.items.length])).toEqual([['O1', 2], ['O2', 1]]);
  });
  it('agrupa las actividades por grupo, ordenadas por grupo y por actividad', () => {
    const a = (groupOrder: number, groupTitle: string, sortOrder: number, description: string): ActivityItem => ({
      id: description, jobPositionId: 'p', groupOrder, groupTitle, sortOrder, description, frequency: 'mensual', note: null,
    });
    const groups = groupActivities([a(2, 'Dos', 1, 'd'), a(1, 'Uno', 2, 'b'), a(1, 'Uno', 1, 'a')]);
    expect(groups.map((g) => [g.order, g.items.map((i) => i.description)])).toEqual([[1, ['a', 'b']], [2, ['d']]]);
  });
  it('etiquetas: periodo de plantilla, plazas, vacante, códigos y frecuencias nuevas', () => {
    expect(okrPeriodLabel(null)).toBe('Plantilla (Sin Periodo)');
    expect(okrPeriodLabel('base')).toBe('Plantilla (Sin Periodo)');
    expect(okrPeriodLabel('2026-S2')).toBe('Semestre 2 · 2026');
    expect(plazasLabel(0)).toBe('Vacante');
    expect(plazasLabel(3)).toBe('3');
    expect(plazasLabel(null)).toBe('—');
    expect(okrCode({ objectiveCode: 'O1', krCode: 'KR2' })).toBe('O1 · KR2');
    expect(okrCode({ objectiveCode: 'O1', krCode: null })).toBe('O1');
    expect(okrCode({})).toBe('');
    expect(frequencyLabel('semanal')).toBe('Semanal');
    expect(frequencyLabel('diario')).toBe('Diario');
    expect(frequencyLabel('eventual')).toBe('Eventual');
  });
});
