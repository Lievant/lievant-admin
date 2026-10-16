import {
  accountSortValue,
  STATUS_LABEL,
  type AccountRow,
  type AccountSortKey,
  type DisplayStatus,
} from '../../../../web/src/app/(dashboard)/herramientas/passwords/account-sort';
import { nextSort, nextSortCycle, sortRows } from '../../../../web/src/lib/sort-rows';

// ── Comparador ───────────────────────────────────────────────────────────────

describe('sortRows', () => {
  const by = (rows: (string | number | null)[], dir: 'asc' | 'desc') => sortRows(rows, (r) => r, dir);

  it('texto sin distinguir acentos ni mayúsculas', () => {
    expect(by(['Zeta', 'álvarez', 'Alvarez', 'beta'], 'asc')).toEqual(['álvarez', 'Alvarez', 'beta', 'Zeta']);
  });

  it('números dentro del texto se ordenan como números', () => {
    expect(by(['Cuenta 10', 'Cuenta 2', 'Cuenta 1'], 'asc')).toEqual(['Cuenta 1', 'Cuenta 2', 'Cuenta 10']);
    expect(by(['Cuenta 10', 'Cuenta 2', 'Cuenta 1'], 'desc')).toEqual(['Cuenta 10', 'Cuenta 2', 'Cuenta 1']);
  });

  it('números por su valor, no como texto', () => {
    expect(by([10, 2, 33, 1], 'asc')).toEqual([1, 2, 10, 33]);
    expect(by([10, 2, 33, 1], 'desc')).toEqual([33, 10, 2, 1]);
  });

  it('vacíos y textos en blanco siempre al final, en ambos sentidos', () => {
    expect(by(['b', null, 'a', '  '], 'asc')).toEqual(['a', 'b', null, '  ']);
    expect(by(['b', null, 'a', '  '], 'desc')).toEqual(['b', 'a', null, '  ']);
  });

  it('es estable: los empates conservan su orden original', () => {
    const rows = [
      { k: 'x', id: 1 },
      { k: 'y', id: 2 },
      { k: 'x', id: 3 },
      { k: 'y', id: 4 },
    ];
    expect(sortRows(rows, (r) => r.k, 'asc').map((r) => r.id)).toEqual([1, 3, 2, 4]);
    expect(sortRows(rows, (r) => r.k, 'desc').map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  it('no modifica el arreglo original', () => {
    const rows = ['b', 'a'];
    sortRows(rows, (r) => r, 'asc');
    expect(rows).toEqual(['b', 'a']);
  });
});

// ── Ciclo de tres estados ────────────────────────────────────────────────────

describe('nextSortCycle', () => {
  it('ascendente → descendente → sin orden', () => {
    const first = nextSortCycle<'a' | 'b'>(null, 'a');
    expect(first).toEqual({ key: 'a', dir: 'asc' });
    const second = nextSortCycle(first, 'a');
    expect(second).toEqual({ key: 'a', dir: 'desc' });
    expect(nextSortCycle(second, 'a')).toBeNull();
  });

  it('al ordenar por otra columna la anterior se limpia y arranca ascendente', () => {
    expect(nextSortCycle<'a' | 'b'>({ key: 'a', dir: 'desc' }, 'b')).toEqual({ key: 'b', dir: 'asc' });
    expect(nextSortCycle<'a' | 'b'>({ key: 'a', dir: 'asc' }, 'b')).toEqual({ key: 'b', dir: 'asc' });
  });

  it('después de quitar el orden, el siguiente clic vuelve a empezar ascendente', () => {
    expect(nextSortCycle<'a'>(null, 'a')).toEqual({ key: 'a', dir: 'asc' });
  });

  it('nextSort (el de otras tablas) sigue siendo de dos estados', () => {
    expect(nextSort({ key: 'a', dir: 'desc' }, 'a')).toEqual({ key: 'a', dir: 'asc' });
  });
});

// ── Valores por columna ──────────────────────────────────────────────────────

function row(
  n: number,
  over: {
    app?: string;
    name?: string;
    area?: string | null;
    user?: string;
    assigned?: string;
    expiry?: string | null;
    status?: DisplayStatus;
  } = {},
): AccountRow {
  return {
    status: over.status ?? 'activa',
    account: {
      recordNumber: n,
      application: { name: over.app ?? 'Zoom' },
      employee: { fullName: over.name ?? 'Ana', area: over.area === undefined ? 'TI' : over.area },
      username: over.user ?? 'a@x.com',
      assignedDate: over.assigned ?? '2026-01-01',
      expiryDate: over.expiry === undefined ? null : over.expiry,
    },
  };
}

const order = (rows: AccountRow[], key: AccountSortKey, dir: 'asc' | 'desc') =>
  sortRows(rows, (r) => accountSortValue(r, key), dir).map((r) => r.account.recordNumber);

describe('Orden de la tabla de contraseñas', () => {
  it('No. es numérico', () => {
    const rows = [row(10), row(2), row(33)];
    expect(order(rows, 'recordNumber', 'asc')).toEqual([2, 10, 33]);
    expect(order(rows, 'recordNumber', 'desc')).toEqual([33, 10, 2]);
  });

  it('Aplicación, Colaborador y Usuario ordenan por texto sin acentos', () => {
    const rows = [row(1, { app: 'Zoom', name: 'Zulema', user: 'z@x.com' }), row(2, { app: 'Ábaco', name: 'Álvaro', user: 'a@x.com' }), row(3, { app: 'Miro', name: 'Marta', user: 'm@x.com' })];
    expect(order(rows, 'application', 'asc')).toEqual([2, 3, 1]);
    expect(order(rows, 'employee', 'asc')).toEqual([2, 3, 1]);
    expect(order(rows, 'username', 'desc')).toEqual([1, 3, 2]);
  });

  it('Área con vacío al final en ambos sentidos', () => {
    const rows = [row(1, { area: null }), row(2, { area: 'Finanzas' }), row(3, { area: 'Ventas' })];
    expect(order(rows, 'area', 'asc')).toEqual([2, 3, 1]);
    expect(order(rows, 'area', 'desc')).toEqual([3, 2, 1]);
  });

  it('Asignación ordena por la fecha real, no por el texto', () => {
    // Como texto "9 mar" > "10 ene"; como fecha, enero va primero.
    const rows = [row(1, { assigned: '2026-03-09' }), row(2, { assigned: '2025-12-31' }), row(3, { assigned: '2026-01-10' })];
    expect(order(rows, 'assignedDate', 'asc')).toEqual([2, 3, 1]);
    expect(order(rows, 'assignedDate', 'desc')).toEqual([1, 3, 2]);
  });

  it('"Sin vencimiento" queda siempre al final, ascendente y descendente', () => {
    const rows = [row(1, { expiry: null }), row(2, { expiry: '2027-05-01' }), row(3, { expiry: '2026-02-15' }), row(4, { expiry: null })];
    expect(order(rows, 'expiryDate', 'asc')).toEqual([3, 2, 1, 4]);
    expect(order(rows, 'expiryDate', 'desc')).toEqual([2, 3, 1, 4]);
  });

  it('Estado ordena por la etiqueta visible', () => {
    const rows = [
      row(1, { status: 'vencida' }),
      row(2, { status: 'activa' }),
      row(3, { status: 'revocada' }),
      row(4, { status: 'por_vencer' }),
    ];
    // Activa, Por vencer, Revocada, Vencida
    expect(order(rows, 'status', 'asc')).toEqual([2, 4, 3, 1]);
    expect(order(rows, 'status', 'desc')).toEqual([1, 3, 4, 2]);
    expect(STATUS_LABEL.por_vencer).toBe('Por vencer');
  });

  it('el orden se aplica sobre lo ya filtrado', () => {
    const all = [row(1, { app: 'Zoom' }), row(2, { app: 'Miro' }), row(3, { app: 'Zoom', status: 'revocada' }), row(4, { app: 'Ábaco' })];
    const filtered = all.filter((r) => r.status !== 'revocada');
    expect(order(filtered, 'application', 'asc')).toEqual([4, 2, 1]);
  });

  it('un empate conserva el orden original', () => {
    const rows = [row(7, { app: 'Zoom' }), row(3, { app: 'Zoom' }), row(5, { app: 'Zoom' })];
    expect(order(rows, 'application', 'asc')).toEqual([7, 3, 5]);
    expect(order(rows, 'application', 'desc')).toEqual([7, 3, 5]);
  });

  it('el orden nunca lee la contraseña: AccountSortKey no incluye password ni acciones', () => {
    const keys: AccountSortKey[] = ['recordNumber', 'application', 'employee', 'area', 'username', 'assignedDate', 'expiryDate', 'status'];
    const r = row(1) as AccountRow & { account: Record<string, unknown> };
    r.account.password = 'SECRETO';
    for (const k of keys) expect(String(accountSortValue(r, k))).not.toContain('SECRETO');
  });
});
