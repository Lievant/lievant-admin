import {
  cleanTitle,
  deduceDivision,
  norm,
  parseActivities,
  parseKpis,
  parseMatrixSheets as parseSheets,
  parseOkrs,
  type ImportIssue,
  type RawSheet,
} from './job-positions-import.parser';

const LEVELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const parseMatrixSheets = (sheets: RawSheet[]) => parseSheets(sheets, { levelCodes: LEVELS });

const issues = () => ({ warnings: [] as ImportIssue[], errors: [] as ImportIssue[] });

describe('Importación de la Matriz · actividades', () => {
  const text = [
    '1. TEST-Gestión de campañas.',
    '   1.1 Planear la campaña del mes (Mensual)',
    '   1.2 Revisar el tablero (Diario)',
    '2. TEST-Reportes.',
    '   2.1 Entregar el reporte (Semestral) - Visión de largo plazo',
    '   2.2 Atender solicitudes (A veces)',
    'texto suelto que no encaja',
  ].join('\n');

  it('separa grupos y actividades, con frecuencia y nota tras el paréntesis', () => {
    const { warnings, errors } = issues();
    const acts = parseActivities(text, 5, warnings, errors);
    expect(acts).toHaveLength(4);
    expect(acts[0]).toEqual({ groupOrder: 1, groupTitle: 'TEST-Gestión de campañas.', sortOrder: 1, description: 'Planear la campaña del mes', frequency: 'mensual', note: null });
    expect(acts[1]).toMatchObject({ sortOrder: 2, frequency: 'diario' });
    expect(acts[2]).toMatchObject({ groupOrder: 2, description: 'Entregar el reporte', frequency: 'semestral', note: 'Visión de largo plazo' });
    expect(errors).toEqual([]);
  });

  it('frecuencia desconocida: NULL y aviso; línea que no encaja: aviso y se ignora', () => {
    const { warnings, errors } = issues();
    const acts = parseActivities(text, 5, warnings, errors);
    expect(acts[3]).toMatchObject({ description: 'Atender solicitudes (A veces)', frequency: null, note: null });
    expect(warnings.map((w) => w.message).join('|')).toMatch(/2\.2 no trae una frecuencia reconocida/);
    expect(warnings.map((w) => w.message).join('|')).toMatch(/Línea de actividades no reconocida/);
    expect(warnings.every((w) => w.row === 5)).toBe(true);
  });

  it('usa el ÚLTIMO paréntesis que sea una frecuencia (los otros son parte del texto)', () => {
    const { warnings, errors } = issues();
    const [a] = parseActivities('1. G.\n   1.1 Revisar (SEO) y pauta (Trimestral)', 4, warnings, errors);
    expect(a).toMatchObject({ description: 'Revisar (SEO) y pauta', frequency: 'trimestral' });
  });

  it('un signo suelto tras la frecuencia se conserva como nota', () => {
    const [a] = parseActivities(['1. G.', '   1.1 Revisar piezas (Semanal) -'].join('\n'), 4, [], []);
    expect(a).toMatchObject({ frequency: 'semanal', note: '-' });
  });

  it('reconoce todas las frecuencias, sin acentos ni mayúsculas', () => {
    const { warnings, errors } = issues();
    const lines = ['Diario', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Eventual'].map((f, i) => `   1.${i + 1} Act (${f})`);
    const acts = parseActivities(['1. G.', ...lines].join('\n'), 4, warnings, errors);
    expect(acts.map((a) => a.frequency)).toEqual(['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual', 'eventual']);
  });

  it('una actividad sin grupo se guarda en «Sin grupo» con aviso', () => {
    const { warnings, errors } = issues();
    const acts = parseActivities('   1.1 Algo (Mensual)', 4, warnings, errors);
    expect(acts[0]!.groupTitle).toBe('Sin grupo');
    expect(warnings).toHaveLength(1);
  });

  it('texto vacío: sin actividades', () => {
    expect(parseActivities('', 4, [], [])).toEqual([]);
  });
});

describe('Importación de la Matriz · OKRs', () => {
  it('una fila por resultado clave, con el objetivo repetido y los códigos', () => {
    const { warnings, errors } = issues();
    const okrs = parseOkrs(['O1: TEST-Crecer ventas.', '   KR1: Subir 10 %.', '   KR2: Bajar el costo.', 'O2: TEST-Mejorar servicio.', '   KR1: NPS de 70.'].join('\n'), 5, warnings, errors);
    expect(okrs).toEqual([
      { objectiveCode: 'O1', krCode: 'KR1', objective: 'TEST-Crecer ventas.', keyResult: 'Subir 10 %.', sortOrder: 1 },
      { objectiveCode: 'O1', krCode: 'KR2', objective: 'TEST-Crecer ventas.', keyResult: 'Bajar el costo.', sortOrder: 2 },
      { objectiveCode: 'O2', krCode: 'KR1', objective: 'TEST-Mejorar servicio.', keyResult: 'NPS de 70.', sortOrder: 3 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('un objetivo sin resultados clave crea una fila «Por definir» con aviso', () => {
    const { warnings, errors } = issues();
    const okrs = parseOkrs('O1: TEST-Solo objetivo.\nO2: TEST-Otro.\n   KR1: Algo.', 5, warnings, errors);
    expect(okrs).toHaveLength(2);
    expect(okrs[0]).toMatchObject({ objectiveCode: 'O1', krCode: 'KR1', keyResult: 'Por definir' });
    expect(okrs[1]).toMatchObject({ objectiveCode: 'O2', keyResult: 'Algo.' });
    expect(warnings).toHaveLength(1);
  });

  it('un KR sin objetivo y una línea rara se ignoran con aviso', () => {
    const { warnings, errors } = issues();
    expect(parseOkrs('   KR1: Huérfano.\nalgo raro', 5, warnings, errors)).toEqual([]);
    expect(warnings).toHaveLength(2);
  });
});

describe('Importación de la Matriz · KPIs', () => {
  it('indicador | meta | frecuencia', () => {
    const { warnings, errors } = issues();
    const kpis = parseKpis('• TEST-Ventas | Meta: 10 millones | Mensual\n• TEST-NPS | Meta: 70 | Semanal\n• TEST-Cobertura | Meta: 95 % | Diario', 5, warnings, errors);
    expect(kpis).toEqual([
      { name: 'TEST-Ventas', targetValue: '10 millones', frequency: 'mensual', description: null },
      { name: 'TEST-NPS', targetValue: '70', frequency: 'semanal', description: null },
      { name: 'TEST-Cobertura', targetValue: '95 %', frequency: 'diario', description: null },
    ]);
    expect(warnings).toEqual([]);
  });

  it('frecuencia con texto pegado: la primera palabra reconocible es la frecuencia y el resto va a la descripción', () => {
    const { warnings, errors } = issues();
    const kpis = parseKpis(
      ['• TEST-A | Meta: 1 | Mensual - Tiempos de respuesta no mayor a una hora', '• TEST-B | Meta: 2 | Mensual   Share - % de participación', '• TEST-C | Meta: 3 | Trimestral - Asegurar el cumplimiento'].join('\n'),
      5,
      warnings,
      errors,
    );
    expect(kpis[0]).toMatchObject({ frequency: 'mensual', description: 'Tiempos de respuesta no mayor a una hora' });
    expect(kpis[1]).toMatchObject({ frequency: 'mensual', description: 'Share - % de participación' });
    expect(kpis[2]).toMatchObject({ frequency: 'trimestral', description: 'Asegurar el cumplimiento' });
  });

  it('meta de más de 100 caracteres: se recorta y el texto completo va a la descripción, con aviso', () => {
    const { warnings, errors } = issues();
    const long = 'x'.repeat(130);
    const [k] = parseKpis(`• TEST-Largo | Meta: ${long} | Mensual`, 5, warnings, errors);
    expect(k!.targetValue).toHaveLength(100);
    expect(k!.description).toBe(`Meta: ${long}`);
    expect(warnings).toHaveLength(1);
  });

  it('línea mal formada o sin viñeta: aviso y se ignora; frecuencia desconocida: NULL con aviso', () => {
    const { warnings, errors } = issues();
    const kpis = parseKpis('• TEST-Sin partes\nsin viñeta | Meta: 1 | Mensual\n• TEST-Rara | Meta: 1 | cada luna', 5, warnings, errors);
    expect(kpis).toEqual([{ name: 'TEST-Rara', targetValue: '1', frequency: null, description: 'cada luna' }]);
    expect(warnings).toHaveLength(3);
  });
});

describe('Importación de la Matriz · título, división y hoja', () => {
  it('quita (VACANTE) en cualquier mayúscula', () => {
    expect(cleanTitle('Líder Regional (VACANTE)')).toEqual({ title: 'Líder Regional', vacant: true });
    expect(cleanTitle('Líder  (vacante)  Regional')).toEqual({ title: 'Líder Regional', vacant: true });
    expect(cleanTitle('  Analista ')).toEqual({ title: 'Analista', vacant: false });
  });
  it('deduce la división del título de la hoja', () => {
    expect(deduceDivision('Matriz de Puestos – División E-Commerce · Propuesta de actividades')).toBe('E-Commerce');
    expect(deduceDivision('Matriz sin nombre')).toBeNull();
  });
  it('normaliza sin acentos ni mayúsculas', () => {
    expect(norm('  Sub-Área   ')).toBe('sub-area');
  });
});

/** Hoja sintética con el mismo formato del Excel: título, fila vacía, encabezados en la fila 3. */
const HEADER = [
  '#', 'Sub-área', 'Puesto', 'Nivel tabular (HC oct-26)', 'Jerarquía (MEOT)', 'Reporta a', 'Supervisa a', 'Plazas ocupadas', 'Rol',
  'Objetivo del puesto (propuesta)', 'Responsabilidades y actividades (frecuencia)', 'OKRs propuestos', 'KPIs propuestos (indicador | meta | frecuencia)',
  'Puntos a validar', 'Estatus validación', 'Comentarios del Head',
];
const dataRow = (over: Record<number, string> = {}): string[] => {
  const base = [
    '1', 'TEST-Marketplace', 'TEST-Analista (VACANTE)', 'II', 'Operativo', 'TEST-Jefe', 'Nadie', '0', 'TEST-Rol', 'TEST-Objetivo',
    '1. TEST-Grupo.\n   1.1 Hacer algo (Mensual)', 'O1: TEST-Obj.\n   KR1: TEST-KR.', '• TEST-KPI | Meta: 1 | Mensual', 'TEST-Punto', 'Pendiente', '',
  ];
  Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v));
  return base;
};
const sheet = (rows: string[][], name = 'Matriz TEST'): RawSheet => ({
  name,
  rows: [['Matriz de Puestos – División TEST-Ecom · Propuesta'], [], HEADER, ...rows],
});

describe('Importación de la Matriz · hoja completa', () => {
  it('lee la fila de encabezados (fila 3), ignora hojas de notas y devuelve el puesto sin (VACANTE)', () => {
    const notes: RawSheet = { name: 'Hoja1', rows: [['comisiones', '10 %']] };
    const r = parseMatrixSheets([{ name: 'Instrucciones', rows: [['Instrucciones'], ['1. Llena la matriz']] }, sheet([dataRow()]), notes]);
    expect(r.errors).toEqual([]);
    expect(r.sheetName).toBe('Matriz TEST');
    expect(r.divisionHint).toBe('TEST-Ecom');
    expect(r.positions).toHaveLength(1);
    const p = r.positions[0]!;
    expect(p).toMatchObject({ row: 4, title: 'TEST-Analista', area: 'TEST-Marketplace', level: 'II', plazas: 0, validationStatus: 'pendiente', headComments: null, roleSummary: 'TEST-Rol', positionObjective: 'TEST-Objetivo' });
    expect(p.activities).toHaveLength(1);
    expect(p.okrs).toHaveLength(1);
    expect(p.kpis).toHaveLength(1);
  });

  it('mapea por nombre: columnas en otro orden y con una faltante', () => {
    const rows: RawSheet = {
      name: 'Matriz TEST',
      rows: [
        ['Título'],
        [],
        ['Plazas ocupadas', 'Puesto', 'Sub-área', 'KPIs propuestos (indicador | meta | frecuencia)', 'Columna desconocida'],
        ['3', 'TEST-Gerente', 'TEST-Performance', '• TEST-K | Meta: 5 | Semanal', 'ruido'],
      ],
    };
    const r = parseMatrixSheets([rows]);
    expect(r.errors).toEqual([]);
    expect(r.positions[0]).toMatchObject({ title: 'TEST-Gerente', area: 'TEST-Performance', plazas: 3, level: null, roleSummary: null });
    expect(r.positions[0]!.kpis[0]!.frequency).toBe('semanal');
    expect(r.columns.has('level')).toBe(false);
    expect(r.warnings.some((w) => /columna «Nivel tabular»/.test(w.message))).toBe(true);
  });

  it('encuentra la hoja por los encabezados cuando ninguna se llama Matriz', () => {
    const r = parseMatrixSheets([{ name: 'Datos', rows: [HEADER, dataRow()] }]);
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0]!.row).toBe(2);
  });

  it('sin encabezados reconocibles: error bloqueante', () => {
    const r = parseMatrixSheets([{ name: 'Algo', rows: [['a', 'b'], ['1', '2']] }]);
    expect(r.errors[0]!.message).toMatch(/No se encontró la hoja de la matriz/);
    expect(r.positions).toEqual([]);
  });

  it('ignora filas vacías; falta Puesto o Sub-área: error con su fila', () => {
    const r = parseMatrixSheets([sheet([dataRow(), [], dataRow({ 2: '' }), dataRow({ 1: '', 2: 'TEST-Sin área' })])]);
    expect(r.positions).toHaveLength(1);
    expect(r.errors.map((e) => `${e.row}:${e.message}`)).toEqual(['6:Falta el Puesto', '7:Falta la Sub-área del puesto «TEST-Sin área»']);
  });

  it('texto más largo que la columna: error bloqueante; puesto repetido en la misma sub-área: error', () => {
    const r = parseMatrixSheets([sheet([dataRow({ 2: 'T'.repeat(201) }), dataRow({ 2: 'TEST-Igual' }), dataRow({ 2: ' test-igual ' })])]);
    expect(r.errors.some((e) => /El Puesto pasa de 200/.test(e.message))).toBe(true);
    expect(r.errors.some((e) => /ya aparece en la fila 5/.test(e.message))).toBe(true);
  });

  it('estatus de validación: valores válidos y desconocidos; comentarios del Head', () => {
    const r = parseMatrixSheets([
      sheet([
        dataRow({ 2: 'TEST-A', 14: 'Validado con ajustes', 15: 'Ajustar el KPI' }),
        dataRow({ 2: 'TEST-B', 14: 'Rechazado' }),
        dataRow({ 2: 'TEST-C', 14: 'Quizá' }),
      ]),
    ]);
    expect(r.positions.map((p) => p.validationStatus)).toEqual(['validado_con_ajustes', 'rechazado', 'pendiente']);
    expect(r.positions[0]!.headComments).toBe('Ajustar el KPI');
    expect(r.warnings.some((w) => /estatus de validación «Quizá»/.test(w.message))).toBe(true);
  });

  it('plazas no entero: vacías con aviso; un puesto (VACANTE) sin plazas queda en 0', () => {
    const r = parseMatrixSheets([sheet([dataRow({ 2: 'TEST-A', 7: 'dos' }), dataRow({ 2: 'TEST-B (VACANTE)', 7: '' })])]);
    expect(r.positions[0]!.plazas).toBeNull();
    expect(r.positions[1]!.plazas).toBe(0);
    expect(r.warnings.some((w) => /Las plazas «dos»/.test(w.message))).toBe(true);
  });
});
