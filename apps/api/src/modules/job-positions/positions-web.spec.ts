import {
  currentPeriod,
  currentSemesterMx,
  currentYearMx,
  formatDateTimeMx,
  formatPct,
  EMPTY_OPTIONS,
  REQUIRED_FIELDS,
  reportsToLabel,
  requiredErrors,
  levelOptionLabel,
  areasForDivision,
  frequencyLabel,
  groupActivities,
  inList,
  seniorityLabel,
  groupOkrs,
  nextPeriod,
  employeesCountLabel,
  positionRefLabel,
  relationsChanged,
  okrWeightError,
  weightSummary,
  okrCode,
  okrPeriodLabel,
  okrsOfPeriod,
  plazasLabel,
  aiLevelLabel,
  vacanciesBadgeLabel,
  type ActivityItem,
  makePeriod,
  parsePeriod,
  periodLabel,
  sumPeriodWeights,
  weightState,
  yearOptions,
  type OkrItem,
} from '../../../../web/src/app/(dashboard)/rrhh/matriz-puestos/positions-constants';

const okr = (period: string, weight: number, isActive = true, over: Partial<OkrItem> = {}): OkrItem => ({
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
  it('los pesos son enteros: 34 + 33 + 33 = 100 sin decimales', () => {
    expect(sumPeriodWeights([okr('2026-S1', 34), okr('2026-S1', 33), okr('2026-S1', 33)], '2026-S1')).toBe(100);
  });
  it('estado de la suma: sin OKRs, incompleto (informativo), completo, pasado', () => {
    expect(weightState(0, 0)).toBe('none');
    expect(weightState(80, 2)).toBe('incomplete');
    expect(weightState(100, 3)).toBe('complete');
    expect(weightState(101, 3)).toBe('over');
  });
  it('el aviso dice «Suma X %, faltan Y %» cuando es menor a 100 y el error cuando pasa de 100', () => {
    expect(weightSummary(80)).toBe('Suma 80 %, faltan 20 % para llegar a 100 %');
    expect(weightSummary(100)).toBe('Suma 100 %');
    expect(weightSummary(120)).toBe('Suma 120 %: pasa de 100 %');
  });
  it('validación del peso en el cliente: obligatorio, entero y de 1 a 100', () => {
    expect(okrWeightError('')).toMatch(/obligatorio/);
    expect(okrWeightError('  ')).toMatch(/obligatorio/);
    for (const bad of ['0', '101', '33.5', '-3', 'abc']) expect(okrWeightError(bad)).toMatch(/entero entre 1 y 100/);
    for (const ok of ['1', '34', '100', ' 50 ']) expect(okrWeightError(ok)).toBeNull();
  });
  it('semestre siguiente para el destino de copiar', () => {
    expect(nextPeriod('2026-S1')).toBe('2026-S2');
    expect(nextPeriod('2026-S2')).toBe('2027-S1');
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

describe('Matriz de Puestos (web) · semestres, grupos y etiquetas (M6-B)', () => {
  it('los OKRs se agrupan por semestre: no se mezclan entre semestres', () => {
    const okrs = [okr('2026-S1', 40), okr('2026-S1', 60), okr('2026-S2', 100), okr('2026-S1', 50, false)];
    expect(okrsOfPeriod(okrs, '2026-S1')).toHaveLength(3);
    expect(sumPeriodWeights(okrs, '2026-S1')).toBe(100);
    expect(sumPeriodWeights(okrs, '2026-S2')).toBe(100);
    expect(sumPeriodWeights(okrs, '2027-S1')).toBe(0);
  });
  it('agrupa los OKRs por objetivo con sus resultados clave, en orden', () => {
    const rows = [
      okr('2026-S1', 10, true, { objectiveCode: 'O1', krCode: 'KR1', objective: 'A' }),
      okr('2026-S1', 10, true, { objectiveCode: 'O1', krCode: 'KR2', objective: 'A' }),
      okr('2026-S1', 10, true, { objectiveCode: 'O2', krCode: 'KR1', objective: 'B' }),
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
  it('etiquetas: semestre, plazas, vacante, códigos y frecuencias nuevas', () => {
    expect(okrPeriodLabel('2026-S2')).toBe('Semestre 2 · 2026');
    expect(plazasLabel(0)).toBe('0');
    expect(plazasLabel(3)).toBe('3');
    expect(plazasLabel(null)).toBe('—');
    expect(vacanciesBadgeLabel(2)).toBe('Con Vacantes (2)');
    expect(vacanciesBadgeLabel(0)).toBeNull();
    expect(aiLevelLabel('basico')).toBe('Básico');
    expect(aiLevelLabel('avanzado')).toBe('Avanzado');
    expect(aiLevelLabel(null)).toBe('Sin Definir');
    expect(okrCode({ objectiveCode: 'O1', krCode: 'KR2' })).toBe('O1 · KR2');
    expect(okrCode({ objectiveCode: 'O1', krCode: null })).toBe('O1');
    expect(okrCode({})).toBe('');
    expect(frequencyLabel('semanal')).toBe('Semanal');
    expect(frequencyLabel('diario')).toBe('Diario');
    expect(frequencyLabel('eventual')).toBe('Eventual');
  });
});

describe('Matriz de Puestos (web) · listas cerradas', () => {
  const catalog = [
    { name: 'Marketplace', division: 'E-Commerce' },
    { name: 'Performance', division: 'E-Commerce' },
    { name: 'Soporte', division: 'Operaciones' },
    { name: 'marketplace ', division: 'e-commerce' },
  ];
  it('el desplegable de áreas se filtra por la división elegida, sin repetidos ni distinguir mayúsculas', () => {
    expect(areasForDivision(catalog, 'E-Commerce')).toEqual(['Marketplace', 'Performance']);
    expect(areasForDivision(catalog, ' operaciones ')).toEqual(['Soporte']);
    expect(areasForDivision(catalog, 'Finanzas')).toEqual([]);
    expect(areasForDivision(catalog, '')).toEqual(['Marketplace', 'Performance', 'Soporte']);
  });
  it('detecta si un valor está en la lista sin distinguir mayúsculas, acentos ni espacios', () => {
    expect(inList(['Dirección'], ' DIRECCION ')).toBe(true);
    expect(inList(['Dirección'], 'Finanzas')).toBe(false);
  });
  it('etiquetas de categoría', () => {
    expect(seniorityLabel('semi_senior')).toBe('Semi Senior');
    expect(seniorityLabel('junior')).toBe('Junior');
    expect(seniorityLabel(null)).toBe('—');
  });
});

describe('Matriz de Puestos (web) · niveles de org_levels', () => {
  it('el desplegable muestra los 9 niveles del catálogo en su orden, como «I - Dirección General»', () => {
    const names = ['Dirección General', 'Dirección', 'Head / Gerencia', 'Líder / Coordinación', 'Especialista Senior / Key Account', 'Senior', 'Semi Senior', 'Junior / Auxiliar', 'Practicante / Trainee'];
    const codes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    const options = { ...EMPTY_OPTIONS, levels: codes.map((code, i) => ({ code, name: names[i]! })) };
    expect(options.levels.map((l) => l.code)).toEqual(codes);
    expect(options.levels).toHaveLength(9);
    expect(options.levels.map(levelOptionLabel)[0]).toBe('I - Dirección General');
    expect(options.levels.map(levelOptionLabel)[8]).toBe('IX - Practicante / Trainee');
  });
});

describe('Matriz de Puestos (web) · obligatorios y «Reporta a»', () => {
  it('un mensaje por cada campo obligatorio vacío (solo espacios cuenta como vacío)', () => {
    expect(requiredErrors({ roleSummary: 'x', positionObjective: 'x', validationPoints: 'x', description: 'x' })).toEqual({});
    expect(requiredErrors({ roleSummary: '', positionObjective: '  ', validationPoints: 'x', description: '' })).toEqual({
      roleSummary: 'El rol es obligatorio',
      positionObjective: 'El objetivo del puesto es obligatorio',
      description: 'La descripción del puesto es obligatoria',
    });
    expect(REQUIRED_FIELDS.map((f) => f.label)).toEqual(['Rol', 'Objetivo del puesto', 'Puntos a validar', 'Descripción del puesto']);
  });
  it('«Reporta a»: nombre (cargo) y «(Baja)» si ya no está activo', () => {
    expect(reportsToLabel({ id: '1', fullName: 'Ana Pérez', position: 'Directora', active: true })).toBe('Ana Pérez (Directora)');
    expect(reportsToLabel({ id: '1', fullName: 'Ana Pérez', position: 'Directora', active: false })).toBe('Ana Pérez (Directora) (Baja)');
    expect(reportsToLabel({ id: '1', fullName: 'Ana Pérez', position: null })).toBe('Ana Pérez');
  });
});

describe('Matriz de Puestos (web) · relaciones y colaboradores', () => {
  const ref = (id: string, title = id) => ({ id, code: `JP-${id}`, title, area: 'TI', level: null });

  it('el contador de colaboradores: singular, plural y «N de M plazas» solo si las plazas no son nulas', () => {
    expect(employeesCountLabel(1, null)).toBe('1 colaborador');
    expect(employeesCountLabel(3, null)).toBe('3 colaboradores');
    expect(employeesCountLabel(0, null)).toBe('0 colaboradores');
    expect(employeesCountLabel(3, 5)).toBe('3 colaboradores · 3 de 5 plazas ocupadas');
    expect(employeesCountLabel(1, 1)).toBe('1 colaborador · 1 de 1 plaza ocupada');
    expect(employeesCountLabel(0, 0)).toBe('0 colaboradores · 0 de 0 plazas ocupadas');
  });

  it('detecta cambios en «Reporta a» y «Supervisa a» (el orden de los supervisados no cuenta)', () => {
    const saved = { reportsTo: ref('a'), supervises: [ref('b'), ref('c')] };
    expect(relationsChanged({ reportsTo: ref('a'), supervises: [ref('c'), ref('b')] }, saved)).toBe(false);
    expect(relationsChanged({ reportsTo: null, supervises: [ref('b'), ref('c')] }, saved)).toBe(true);
    expect(relationsChanged({ reportsTo: ref('z'), supervises: [ref('b'), ref('c')] }, saved)).toBe(true);
    expect(relationsChanged({ reportsTo: ref('a'), supervises: [ref('b')] }, saved)).toBe(true);
    expect(relationsChanged({ reportsTo: ref('a'), supervises: [ref('b'), ref('d')] }, saved)).toBe(true);
    expect(relationsChanged({ reportsTo: null, supervises: [] }, { reportsTo: null, supervises: [] })).toBe(false);
  });

  it('etiqueta de un puesto enlazado: código, título y área', () => {
    expect(positionRefLabel(ref('1', 'Director'))).toBe('JP-1 · Director · TI');
  });
});
