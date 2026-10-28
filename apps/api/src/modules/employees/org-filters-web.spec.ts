import {
  EMPTY_SELECTION,
  NONE_VALUE,
  activeFilterCount,
  applySelection,
  areaOptions,
  countsLabel,
  divisionOptions,
  levelLabel,
  levelShort,
  sanitizeSelection,
  selectionFromParams,
  selectionToQuery,
  type OrgFilterOptions,
} from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-filters';

const options: OrgFilterOptions = {
  total: 15,
  companies: [],
  divisions: [],
  areas: [],
  levels: [],
  locations: [],
  combinations: [
    { company: 'Lievant', division: 'Tecnología', area: 'TI', count: 5 },
    { company: 'Lievant', division: 'Tecnología', area: 'Datos', count: 3 },
    { company: 'Lievant', division: 'Comercial', area: 'Ventas', count: 2 },
    { company: 'Filial', division: 'Operaciones', area: 'Soporte', count: 4 },
    { company: 'Filial', division: null, area: null, count: 1 },
  ],
};

describe('Organigrama (web) · cascada de filtros', () => {
  it('sin empresa: todas las divisiones con su conteo y "Sin División" al final solo si existe', () => {
    const d = divisionOptions(options, { company: '' });
    expect(d.map((o) => o.label)).toEqual(['Comercial', 'Operaciones', 'Tecnología', 'Sin División']);
    expect(d.find((o) => o.label === 'Tecnología')!.count).toBe(8);
    expect(d.at(-1)).toEqual({ value: NONE_VALUE, label: 'Sin División', count: 1 });
  });
  it('con empresa: solo las divisiones de esa empresa', () => {
    expect(divisionOptions(options, { company: 'Lievant' }).map((o) => o.label)).toEqual(['Comercial', 'Tecnología']);
    expect(divisionOptions(options, { company: ' lievant ' }).map((o) => o.label)).toEqual(['Comercial', 'Tecnología']);
  });
  it('áreas de la división (y la empresa) elegidas; sin división, las de la empresa', () => {
    expect(areaOptions(options, { company: 'Lievant', division: 'Tecnología' }).map((o) => o.label)).toEqual(['Datos', 'TI']);
    expect(areaOptions(options, { company: '', division: 'Comercial' }).map((o) => o.label)).toEqual(['Ventas']);
    expect(areaOptions(options, { company: 'Filial', division: '' }).map((o) => `${o.label}:${o.count}`)).toEqual(['Soporte:4', 'Sin Área:1']);
  });
  it('una combinación inexistente no ofrece nada', () => {
    expect(areaOptions(options, { company: 'Filial', division: 'Tecnología' })).toEqual([]);
  });
  it('"Sin División" como padre ofrece las áreas de quienes no tienen división', () => {
    expect(areaOptions(options, { company: '', division: NONE_VALUE }).map((o) => o.label)).toEqual(['Sin Área']);
  });

  it('cambiar la empresa limpia la división y el área que ya no son válidas', () => {
    const sel = { ...EMPTY_SELECTION, company: 'Lievant', division: 'Tecnología', area: 'TI', level: 'II', location: 'León' };
    const next = applySelection(sel, 'company', 'Filial', options);
    expect(next).toMatchObject({ company: 'Filial', division: '', area: '', level: 'II', location: 'León' });
  });
  it('conserva el hijo si sigue siendo válido con el nuevo padre', () => {
    const sel = { ...EMPTY_SELECTION, division: 'Tecnología', area: 'TI' };
    expect(applySelection(sel, 'company', 'Lievant', options)).toMatchObject({ company: 'Lievant', division: 'Tecnología', area: 'TI' });
  });
  it('cambiar la división limpia el área inválida', () => {
    const sel = { ...EMPTY_SELECTION, company: 'Lievant', division: 'Tecnología', area: 'TI' };
    expect(applySelection(sel, 'division', 'Comercial', options)).toMatchObject({ division: 'Comercial', area: '' });
  });
  it('nivel y ubicación no dependen de la cascada', () => {
    const sel = { ...EMPTY_SELECTION, company: 'Lievant', level: 'II', location: 'León' };
    expect(applySelection(sel, 'company', 'Filial', options)).toMatchObject({ level: 'II', location: 'León' });
    expect(sanitizeSelection({ ...EMPTY_SELECTION, level: 'III', location: 'Medellín' }, options)).toMatchObject({ level: 'III', location: 'Medellín' });
  });
});

describe('Organigrama (web) · URL y textos', () => {
  it('arma el query solo con los filtros activos y los lee de vuelta', () => {
    expect(selectionToQuery(EMPTY_SELECTION)).toBe('');
    const sel = { ...EMPTY_SELECTION, company: 'Lievant', area: 'TI', level: 'II' };
    const q = selectionToQuery(sel);
    expect(q).toBe('company=Lievant&area=TI&level=II');
    expect(selectionFromParams(new URLSearchParams(q))).toEqual(sel);
    expect(selectionFromParams({ company: ['A', 'B'], level: undefined })).toMatchObject({ company: 'A', level: '' });
  });
  it('cuenta los filtros activos', () => {
    expect(activeFilterCount(EMPTY_SELECTION)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_SELECTION, company: 'X', level: NONE_VALUE })).toBe(2);
  });
  it('nivel para el nodo y la vista móvil', () => {
    expect(levelLabel('iii')).toBe('Nivel III');
    expect(levelLabel(' II ')).toBe('Nivel II');
    expect(levelLabel(null)).toBe('');
    expect(levelShort(' iv ')).toBe('IV');
    expect(levelShort('')).toBe('');
  });
  it('contador "Mostrando X de Y Colaboradores"', () => {
    expect(countsLabel(4, 12)).toBe('Mostrando 4 de 12 Colaboradores');
  });
});
