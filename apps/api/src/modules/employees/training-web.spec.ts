import {
  formatDay,
  formatDuration,
  formatRange,
  developmentTypeLabel,
  levelLabel,
  trainingQuery,
  validateTrainingForm,
  yearsOf,
  type TrainingFormValues,
} from '../../../../web/src/app/(dashboard)/rrhh/empleados/training-constants';

const ok: TrainingFormValues = {
  name: 'Curso', institution: 'Inst', developmentType: 'tecnico', level: '',
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
