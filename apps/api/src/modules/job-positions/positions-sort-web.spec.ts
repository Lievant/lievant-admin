import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SortColumnHeader } from '../../../../web/src/components/ui/sort-column-header';
import { nextSortCycle } from '../../../../web/src/lib/sort-rows';
import {
  SORT_COLUMNS,
  applySortParams,
  parseSort,
  sortQuery,
  type PositionSort,
  type PositionSortKey,
} from '../../../../web/src/app/(dashboard)/rrhh/matriz-puestos/positions-sort';
import { POSITION_SORT_COLUMNS } from './job-positions.util';

/** El encabezado va dentro de una tabla, como en la pantalla. */
const render = (sort: PositionSort | null, column: PositionSortKey = 'title', align?: 'right') =>
  renderToStaticMarkup(
    createElement('table', null, createElement('thead', null, createElement('tr', null, createElement(SortColumnHeader<PositionSortKey>, { label: 'Puesto', column, sort, onSort: () => undefined, ...(align ? { align } : {}) })))),
  );

describe('Matriz de Puestos (web) · encabezado ordenable', () => {
  it('es un botón accesible dentro del <th>, con el texto de la columna', () => {
    const html = render(null);
    expect(html).toMatch(/<th[^>]*>\s*<button type="button"/);
    expect(html).toContain('Puesto');
  });

  it('sin orden: aria-sort="none" y un indicador sutil (⇅) de que se puede ordenar', () => {
    const html = render(null);
    expect(html).toContain('aria-sort="none"');
    expect(html).toContain('⇅');
    expect(html).not.toContain('▲');
    expect(html).not.toContain('▼');
  });

  it('columna activa ascendente: aria-sort="ascending" y flecha ▲', () => {
    const html = render({ key: 'title', dir: 'asc' });
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('▲');
    expect(html).not.toContain('⇅');
  });

  it('columna activa descendente: aria-sort="descending" y flecha ▼', () => {
    const html = render({ key: 'title', dir: 'desc' });
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('▼');
  });

  it('las demás columnas siguen en none cuando otra está ordenada (solo una a la vez)', () => {
    const html = render({ key: 'code', dir: 'asc' }, 'title');
    expect(html).toContain('aria-sort="none"');
    expect(html).toContain('⇅');
  });

  it('la flecha es decorativa para lectores de pantalla y el botón es operable con teclado (un <button>)', () => {
    const html = render({ key: 'title', dir: 'asc' });
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>▲<\/span>/);
    expect(html).toContain('focus-visible:outline');
    expect(html).not.toMatch(/<th[^>]*onclick/i);
  });
});

describe('Matriz de Puestos (web) · ciclo y URL del orden', () => {
  it('clic: ascendente → descendente → sin orden; otra columna arranca ascendente', () => {
    let sort: PositionSort | null = null;
    sort = nextSortCycle(sort, 'title');
    expect(sort).toEqual({ key: 'title', dir: 'asc' });
    sort = nextSortCycle(sort, 'title');
    expect(sort).toEqual({ key: 'title', dir: 'desc' });
    sort = nextSortCycle(sort, 'title');
    expect(sort).toBeNull();
    sort = nextSortCycle({ key: 'title', dir: 'desc' }, 'level');
    expect(sort).toEqual({ key: 'level', dir: 'asc' });
  });

  it('las columnas de la tabla son exactamente las que acepta el API, y ninguna es de acciones', () => {
    expect(SORT_COLUMNS.map((c) => c.key)).toEqual([...POSITION_SORT_COLUMNS]);
    expect(SORT_COLUMNS.map((c) => c.label)).toEqual(['Código', 'Puesto', 'División', 'Área', 'Nivel', 'Categoría', 'Plazas', 'Validación', 'Estado']);
  });

  it('el orden se escribe y se lee de la URL (sortBy y sortDir)', () => {
    expect(sortQuery({ key: 'level', dir: 'desc' })).toBe('sortBy=level&sortDir=desc');
    expect(sortQuery(null)).toBe('');
    expect(parseSort(new URLSearchParams('sortBy=level&sortDir=desc'))).toEqual({ key: 'level', dir: 'desc' });
    expect(parseSort({ sortBy: 'plazas' })).toEqual({ key: 'plazas', dir: 'asc' });
    expect(parseSort({ sortBy: ['title', 'code'], sortDir: ['desc'] })).toEqual({ key: 'title', dir: 'desc' });
  });

  it('un orden inválido en la URL se ignora (queda el orden original)', () => {
    expect(parseSort(new URLSearchParams('sortBy=salary&sortDir=desc'))).toBeNull();
    expect(parseSort(new URLSearchParams('sortDir=desc'))).toBeNull();
    expect(parseSort({})).toBeNull();
    expect(parseSort(new URLSearchParams('sortBy=code&sortDir=up'))).toEqual({ key: 'code', dir: 'asc' });
  });

  it('el orden se suma a los parámetros del API sin tocar los filtros, y sin orden no agrega nada', () => {
    const q = new URLSearchParams({ page: '1', limit: '25', division: 'TI', search: 'ana' });
    applySortParams(q, { key: 'level', dir: 'asc' });
    expect(Object.fromEntries(q)).toEqual({ page: '1', limit: '25', division: 'TI', search: 'ana', sortBy: 'level', sortDir: 'asc' });
    const plain = new URLSearchParams({ page: '1' });
    applySortParams(plain, null);
    expect(plain.has('sortBy')).toBe(false);
  });
});
