import {
  DEVELOPMENT_TYPE_OPTIONS,
  DURATION_UNIT_OPTIONS,
  LEVEL_OPTIONS,
  formatDay,
  formatDuration,
  formatRange,
  developmentTypeLabel,
  levelLabel,
  trainingQuery,
  validateTrainingForm,
  yearsOf,
  COMPETENCY_REQUIRED,
  MAX_COMPETENCIES,
  type TrainingFormValues,
} from '../../../../web/src/app/(dashboard)/rrhh/empleados/training-constants';
import { filterOptions, searchKey, selectedInOrder } from '../../../../web/src/components/ui/multi-select-utils';

const ok: TrainingFormValues = {
  name: 'Curso', institution: 'Inst', developmentType: 'tecnico', level: '', competencyIds: ['c1'],
  startDate: '2026-03-01', endDate: '', durationValue: '', durationUnit: '',
};

describe('Capacitaciones (web) · formato', () => {
  it('etiquetas legibles', () => {
    expect(developmentTypeLabel('habilidades_blandas')).toBe('Habilidades Blandas');
    expect(levelLabel('especializacion')).toBe('Especialización');
    expect(levelLabel(null)).toBe('—');
  });

  it('duración con singular y plural', () => {
    expect(formatDuration(1, 'meses')).toBe('1 Mes');
    expect(formatDuration(20, 'horas')).toBe('20 Horas');
    expect(formatDuration(null, null)).toBe('—');
  });

  it('fechas sin corrimiento de zona y "En Curso" sin fecha de fin', () => {
    expect(formatDay('2026-03-01')).toBe('01/03/2026');
    expect(formatRange('2026-03-01', null)).toBe('01/03/2026 – En Curso');
    expect(formatRange('2026-03-01', '2026-04-15')).toBe('01/03/2026 – 15/04/2026');
  });

  it('años de inicio, del más reciente al más antiguo y sin repetir', () => {
    expect(yearsOf([{ startDate: '2024-01-01' }, { startDate: '2026-02-02' }, { startDate: '2024-09-09' }])).toEqual([2026, 2024]);
  });

  it('query de filtros', () => {
    expect(trainingQuery('', '')).toBe('');
    expect(trainingQuery('tecnico', '2026')).toBe('?type=tecnico&year=2026');
  });
});

describe('Capacitaciones (web) · validación del formulario', () => {
  it('válido', () => expect(validateTrainingForm(ok)).toBeNull());
  it('obligatorios', () => {
    expect(validateTrainingForm({ ...ok, name: ' ' })).toMatch(/nombre/);
    expect(validateTrainingForm({ ...ok, institution: '' })).toMatch(/institución/);
    expect(validateTrainingForm({ ...ok, developmentType: '' })).toMatch(/tipo/);
    expect(validateTrainingForm({ ...ok, startDate: '' })).toMatch(/inicio/);
  });
  it('fecha de fin no menor que la de inicio', () => {
    expect(validateTrainingForm({ ...ok, endDate: '2026-02-01' })).toMatch(/fecha de fin/);
  });
  it('duración y unidad van juntas, entera y positiva', () => {
    expect(validateTrainingForm({ ...ok, durationValue: '5' })).toMatch(/duración/);
    expect(validateTrainingForm({ ...ok, durationUnit: 'horas' })).toMatch(/duración/);
    expect(validateTrainingForm({ ...ok, durationValue: '0', durationUnit: 'horas' })).toMatch(/entero positivo/);
    expect(validateTrainingForm({ ...ok, durationValue: '2.5', durationUnit: 'horas' })).toMatch(/entero positivo/);
    expect(validateTrainingForm({ ...ok, durationValue: '3', durationUnit: 'meses' })).toBeNull();
  });
});

describe('Capacitaciones (web) · competencias en el formulario', () => {
  it('sin competencias se avisa «Selecciona al menos una competencia» y con una ya es válido', () => {
    expect(COMPETENCY_REQUIRED).toBe('Selecciona al menos una competencia');
    expect(validateTrainingForm({ ...ok, competencyIds: [] })).toBe(COMPETENCY_REQUIRED);
    expect(validateTrainingForm({ ...ok, competencyIds: ['c1'] })).toBeNull();
  });

  it('el tope es de 30', () => {
    expect(MAX_COMPETENCIES).toBe(30);
    expect(validateTrainingForm({ ...ok, competencyIds: Array.from({ length: 30 }, (_, i) => `c${i}`) })).toBeNull();
    expect(validateTrainingForm({ ...ok, competencyIds: Array.from({ length: 31 }, (_, i) => `c${i}`) })).toMatch(/más de 30/);
  });

  it('valida en el orden de los campos del modal: nombre, tipo, competencias y luego institución y fechas', () => {
    expect(validateTrainingForm({ ...ok, name: '', developmentType: '', competencyIds: [] })).toMatch(/nombre/);
    expect(validateTrainingForm({ ...ok, developmentType: '', competencyIds: [] })).toMatch(/tipo/);
    expect(validateTrainingForm({ ...ok, competencyIds: [], institution: '' })).toBe(COMPETENCY_REQUIRED);
  });
});

describe('Selector múltiple (web) · utilidades', () => {
  const options = [
    { id: 'a', label: 'Comunicación Efectiva' },
    { id: 'b', label: 'Liderazgo' },
    { id: 'c', label: 'Análisis de datos' },
    { id: 'x', label: 'Vieja', inactive: true },
  ];

  it('busca sin importar mayúsculas ni acentos', () => {
    expect(searchKey('  COMUNICACIÓN   efectiva ')).toBe('comunicacion efectiva');
    expect(filterOptions(options, [], 'comunicacion').map((o) => o.id)).toEqual(['a']);
    expect(filterOptions(options, [], 'ANALISIS').map((o) => o.id)).toEqual(['c']);
  });

  it('no ofrece las ya elegidas ni las inactivas, y sin texto trae todas las demás en su orden', () => {
    expect(filterOptions(options, ['b'], '').map((o) => o.id)).toEqual(['a', 'c']);
    expect(filterOptions(options, [], 'vieja')).toEqual([]);
  });

  it('las elegidas salen en el orden de las opciones; una que ya no está entre ellas queda al final como inactiva', () => {
    expect(selectedInOrder(options, ['c', 'a']).map((o) => o.id)).toEqual(['a', 'c']);
    const withUnknown = selectedInOrder(options, ['zzz', 'b']);
    expect(withUnknown.map((o) => o.id)).toEqual(['b', 'zzz']);
    expect(withUnknown[1]).toMatchObject({ inactive: true });
  });

  it('una inactiva ya elegida se muestra como chip (inactiva) pero no se puede volver a elegir', () => {
    expect(selectedInOrder(options, ['x']).map((o) => [o.id, o.inactive])).toEqual([['x', true]]);
    expect(filterOptions(options, [], '').some((o) => o.id === 'x')).toBe(false);
  });
});

describe('Capacitaciones (web) · listas ampliadas', () => {
  it('tipos de desarrollo en el orden pedido y con sus etiquetas completas', () => {
    expect(DEVELOPMENT_TYPE_OPTIONS.map((o) => o.value)).toEqual(['tecnico', 'habilidades_blandas', 'academico', 'sgsi', 'bienestar_psicosocial']);
    expect(DEVELOPMENT_TYPE_OPTIONS.map((o) => o.label)).toEqual([
      'Técnico', 'Habilidades Blandas', 'Académico',
      'Sistema de Gestión de Seguridad de la Información', 'Bienestar y Factores Psicosociales',
    ]);
    expect(developmentTypeLabel('sgsi')).toBe('Sistema de Gestión de Seguridad de la Información');
    expect(developmentTypeLabel('bienestar_psicosocial')).toBe('Bienestar y Factores Psicosociales');
  });

  it('niveles: Obligatoria al final y sigue siendo opcional', () => {
    expect(LEVEL_OPTIONS.map((o) => o.value)).toEqual(['basico', 'intermedio', 'avanzado', 'especializacion', 'obligatoria']);
    expect(levelLabel('obligatoria')).toBe('Obligatoria');
    expect(validateTrainingForm({ ...ok, level: '' })).toBeNull();
    expect(validateTrainingForm({ ...ok, level: 'obligatoria' })).toBeNull();
  });

  it('unidades de duración: Horas, Días y Meses', () => {
    expect(DURATION_UNIT_OPTIONS.map((o) => [o.value, o.label])).toEqual([['horas', 'Horas'], ['dias', 'Días'], ['meses', 'Meses']]);
  });

  it('formatDuration: singular y plural de cada unidad', () => {
    expect(formatDuration(1, 'dias')).toBe('1 Día');
    expect(formatDuration(5, 'dias')).toBe('5 Días');
    expect(formatDuration(1, 'horas')).toBe('1 Hora');
    expect(formatDuration(2, 'meses')).toBe('2 Meses');
    expect(formatDuration(1, 'meses')).toBe('1 Mes');
    expect(formatDuration(null, null)).toBe('—');
  });

  it('el formulario acepta días como unidad y sigue exigiendo valor y unidad juntos', () => {
    expect(validateTrainingForm({ ...ok, durationValue: '5', durationUnit: 'dias' })).toBeNull();
    expect(validateTrainingForm({ ...ok, durationValue: '', durationUnit: 'dias' })).toMatch(/duración/);
  });
});
