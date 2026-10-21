import { sortByColumn } from '../../../../web/src/lib/sort-by-column';

interface Row {
  id: string;
  assigneeName: string | null | undefined;
  status?: string;
}

const row = (id: string, assigneeName: Row['assigneeName'], status = 'abierto'): Row => ({ id, assigneeName, status });
const KEYS = ['assigneeName'];
const ids = (rows: Row[], dir: 'asc' | 'desc', keys: readonly string[] = KEYS, key = 'assigneeName') =>
  sortByColumn(rows, key, dir, keys).map((r) => r.id);

describe('Tickets · orden por Asignado A', () => {
  const rows = [
    row('t1', 'Paulo Ossa'),
    row('t2', null),
    row('t3', 'Daniel Ortiz'),
    row('t4', 'Enrique Bañuelos'),
    row('t5', undefined),
    row('t6', '  '),
  ];

  it('ascendente por el nombre visible, con los sin asignar al final', () => {
    expect(ids(rows, 'asc').slice(0, 3)).toEqual(['t3', 't4', 't1']);
    expect(ids(rows, 'asc').slice(3)).toEqual(['t2', 't5', 't6']);
  });

  it('descendente: los sin asignar siguen al final', () => {
    expect(ids(rows, 'desc').slice(0, 3)).toEqual(['t1', 't4', 't3']);
    expect(ids(rows, 'desc').slice(3)).toEqual(['t2', 't5', 't6']);
  });

  it('ignora acentos y mayúsculas', () => {
    const accented = [row('a', 'Álvarez'), row('b', 'alvarez'), row('c', 'Beto'), row('d', 'ÁNGEL')];
    // Álvarez y alvarez empatan (conservan su orden), Ángel va después y Beto al final.
    expect(ids(accented, 'asc')).toEqual(['a', 'b', 'd', 'c']);
  });

  it('los números dentro del nombre se ordenan como números', () => {
    const numbered = [row('a', 'Agente 10'), row('b', 'Agente 2'), row('c', 'Agente 1')];
    expect(ids(numbered, 'asc')).toEqual(['c', 'b', 'a']);
  });

  it('es estable con empates y entre los sin asignar', () => {
    const ties = [row('x1', 'Ana'), row('x2', null), row('x3', 'Ana'), row('x4', null)];
    expect(ids(ties, 'asc')).toEqual(['x1', 'x3', 'x2', 'x4']);
    expect(ids(ties, 'desc')).toEqual(['x1', 'x3', 'x2', 'x4']);
  });

  it('no modifica el arreglo original', () => {
    const copy = [...rows];
    sortByColumn(rows, 'assigneeName', 'asc', KEYS);
    expect(rows).toEqual(copy);
  });

  it('las demás columnas conservan el orden de siempre (texto, vacío como texto vacío)', () => {
    const others = [row('a', 'x', 'resuelto'), row('b', 'x', 'abierto'), row('c', 'x', 'cerrado')];
    expect(ids(others, 'asc', KEYS, 'status')).toEqual(['b', 'c', 'a']);
    expect(ids(others, 'desc', KEYS, 'status')).toEqual(['a', 'c', 'b']);
    // Sin la opción, un vacío sigue yendo primero en ascendente (comportamiento previo).
    const empties = [row('a', 'Zoe'), row('b', null)];
    expect(sortByColumn(empties, 'assigneeName', 'asc').map((r) => r.id)).toEqual(['b', 'a']);
  });
});
