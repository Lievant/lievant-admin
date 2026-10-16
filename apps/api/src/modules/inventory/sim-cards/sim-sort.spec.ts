import {
  simSortValue,
  type SimSortKey,
  type SortableSim,
} from '../../../../../web/src/app/(dashboard)/transformacion/sim-cards/sim-sort';
import { nextSort, sortRows } from '../../../../../web/src/lib/sort-rows';

// ── Ajuste A: orden de la tabla de líneas ───────────────────────────────────

function sim(code: string, over: Partial<SortableSim> = {}): SortableSim {
  return {
    simCode: code,
    phoneNumber: '4770000000',
    plan: { name: 'Plan' },
    provider: { name: 'AT&T' },
    employee: null,
    monthlyCost: 100,
    currency: 'MXN',
    termMonths: 12,
    contractEndDate: null,
    assignedDate: null,
    status: 'activa',
    ...over,
  };
}

const codes = (rows: SortableSim[], key: SimSortKey, dir: 'asc' | 'desc') =>
  sortRows(rows, (s) => simSortValue(s, key), dir).map((s) => s.simCode);

describe('Orden de la tabla de líneas telefónicas', () => {
  it('texto sin acentos ni mayúsculas y con números como números', () => {
    const rows = [sim('SIM-010'), sim('SIM-002'), sim('SIM-001')];
    expect(codes(rows, 'simCode', 'asc')).toEqual(['SIM-001', 'SIM-002', 'SIM-010']);
    const plans = [sim('a', { plan: { name: 'Plan 10' } }), sim('b', { plan: { name: 'Plan 2' } }), sim('c', { plan: { name: 'Álamo' } })];
    expect(codes(plans, 'plan', 'asc')).toEqual(['c', 'b', 'a']);
  });

  it('Proveedor y Asignado a: vacíos siempre al final en ambos sentidos', () => {
    const rows = [sim('a', { provider: null }), sim('b', { provider: { name: 'Telcel' } }), sim('c', { provider: { name: 'AT&T' } })];
    expect(codes(rows, 'provider', 'asc')).toEqual(['c', 'b', 'a']);
    expect(codes(rows, 'provider', 'desc')).toEqual(['b', 'c', 'a']);
    const people = [sim('a'), sim('b', { employee: { fullName: 'Zoe' } }), sim('c', { employee: { fullName: 'Ana' } })];
    expect(codes(people, 'employee', 'asc')).toEqual(['c', 'b', 'a']);
    expect(codes(people, 'employee', 'desc')).toEqual(['b', 'c', 'a']);
  });

  it('Plazo es numérico y los vacíos van al final', () => {
    const rows = [sim('a', { termMonths: 24 }), sim('b', { termMonths: null }), sim('c', { termMonths: 6 }), sim('d', { termMonths: 12 })];
    expect(codes(rows, 'termMonths', 'asc')).toEqual(['c', 'd', 'a', 'b']);
    expect(codes(rows, 'termMonths', 'desc')).toEqual(['a', 'd', 'c', 'b']);
  });

  it('Vencimiento y Fecha de asignación por fecha real; sin fecha al final en ambos sentidos', () => {
    const rows = [
      sim('a', { contractEndDate: '2026-03-09', assignedDate: '2026-03-09' }),
      sim('b', { contractEndDate: null, assignedDate: null }),
      sim('c', { contractEndDate: '2025-12-31', assignedDate: '2025-12-31' }),
      sim('d', { contractEndDate: '2026-01-10', assignedDate: '2026-01-10' }),
    ];
    // Como texto "9 mar" > "10 ene"; como fecha, enero va antes.
    expect(codes(rows, 'contractEndDate', 'asc')).toEqual(['c', 'd', 'a', 'b']);
    expect(codes(rows, 'contractEndDate', 'desc')).toEqual(['a', 'd', 'c', 'b']);
    expect(codes(rows, 'assignedDate', 'asc')).toEqual(['c', 'd', 'a', 'b']);
    expect(codes(rows, 'assignedDate', 'desc')).toEqual(['a', 'd', 'c', 'b']);
  });

  it('Valor del plan: primero por moneda y luego por monto; nunca mezcla monedas', () => {
    const rows = [
      sim('mxn-1000', { monthlyCost: 1000, currency: 'MXN' }),
      sim('usd-20', { monthlyCost: 20, currency: 'USD' }),
      sim('mxn-299', { monthlyCost: 299, currency: 'MXN' }),
      sim('usd-5', { monthlyCost: 5, currency: 'USD' }),
      sim('mxn-99', { monthlyCost: 99.5, currency: 'MXN' }),
    ];
    // MXN antes que USD; dentro de cada moneda, por monto (1000 > 299 > 99.5 aunque como texto no lo sea).
    expect(codes(rows, 'planValue', 'asc')).toEqual(['mxn-99', 'mxn-299', 'mxn-1000', 'usd-5', 'usd-20']);
    expect(codes(rows, 'planValue', 'desc')).toEqual(['usd-20', 'usd-5', 'mxn-1000', 'mxn-299', 'mxn-99']);
  });

  it('Estado ordena por la etiqueta visible', () => {
    const rows = [sim('a', { status: 'suspendida' }), sim('b', { status: 'cancelada' }), sim('c', { status: 'activa' })];
    expect(codes(rows, 'status', 'asc')).toEqual(['c', 'b', 'a']);
  });

  it('es estable: los empates conservan el orden original', () => {
    const rows = [sim('x1'), sim('x2'), sim('x3')];
    expect(codes(rows, 'provider', 'asc')).toEqual(['x1', 'x2', 'x3']);
    expect(codes(rows, 'provider', 'desc')).toEqual(['x1', 'x2', 'x3']);
  });

  it('el ciclo es el de Inventario: ascendente ↔ descendente', () => {
    const first = nextSort<SimSortKey>(null, 'plan');
    expect(first).toEqual({ key: 'plan', dir: 'asc' });
    expect(nextSort(first, 'plan')).toEqual({ key: 'plan', dir: 'desc' });
    expect(nextSort({ key: 'plan', dir: 'desc' }, 'simCode')).toEqual({ key: 'simCode', dir: 'asc' });
  });

  it('el orden no lee el ICCID', () => {
    const keys: SimSortKey[] = ['simCode', 'provider', 'phoneNumber', 'plan', 'planValue', 'termMonths', 'contractEndDate', 'employee', 'assignedDate', 'status'];
    const s = sim('a') as SortableSim & { iccid?: string };
    s.iccid = 'ICCID-SECRETO';
    for (const k of keys) expect(String(simSortValue(s, k))).not.toContain('ICCID-SECRETO');
  });
});
