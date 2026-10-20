import 'reflect-metadata';
import { PERMISSION_KEY } from '../../auth/decorators/permission.decorator';
import { SimCardsController } from './sim-cards.controller';
import { SimCardsService } from './sim-cards.service';

const EQ = '11111111-1111-4111-8111-111111111111';

function row(code: string, over: Record<string, unknown> = {}) {
  return {
    id: `id-${code}`,
    sim_code: code,
    phone_number: '4771234567',
    iccid: '8952140000000000001',
    plan_id: 'plan-1',
    plan_name: 'Plan',
    plan_cost: '299.00',
    plan_currency: 'MXN',
    provider_id: 'v1',
    provider_name: 'AT&T',
    employee_id: 'emp-1',
    employee_name: 'Paulo',
    equipment_id: null,
    equipment_display_id: null,
    equipment_brand: null,
    equipment_model: null,
    equipment_employee_id: null,
    equipment_employee_name: null,
    monthly_cost: null,
    currency: 'MXN',
    term_months: null,
    contract_end_date: null,
    activation_date: null,
    assigned_date: null,
    status: 'activa',
    device_type: 'smartphone',
    notes: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

function setup(rows: ReturnType<typeof row>[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const manager = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return rows;
    }),
  };
  const service = new SimCardsService({ manager, transaction: jest.fn() } as any);
  return { service, calls };
}

describe('Detalle del equipo · líneas informativas', () => {
  it('una sola consulta: las ligadas al equipo y las del empleado del equipo, en un mismo predicado (sin duplicar)', async () => {
    const { service, calls } = setup([row('SIM-001'), row('SIM-004', { equipment_id: EQ })]);
    const result = await service.forEquipmentDetail(EQ);

    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0]!;
    expect(sql).toContain('s.equipment_id = $1');
    expect(sql).toMatch(/s\.employee_id = \(\s*SELECT e\.assigned_to_employee_id FROM inventory\.equipment e\s+WHERE e\.id = \$1 AND e\.deleted_at IS NULL/);
    // OR dentro de un solo SELECT: una fila que cumple las dos condiciones sale una vez.
    expect(sql).not.toMatch(/UNION/i);
    expect(params).toEqual([EQ]);
    expect(result.map((r) => r.simCode)).toEqual(['SIM-001', 'SIM-004']);
  });

  it('excluye las líneas dadas de baja y ordena por código', async () => {
    const { service, calls } = setup([]);
    await service.forEquipmentDetail(EQ);
    expect(calls[0]!.sql).toContain('s.deleted_at IS NULL');
    expect(calls[0]!.sql).toContain('ORDER BY s.sim_code ASC');
  });

  it('un equipo sin empleado solo trae las suyas: la subconsulta devuelve NULL y no empata ninguna línea', async () => {
    const { service, calls } = setup([row('SIM-009', { equipment_id: EQ, employee_id: null })]);
    const result = await service.forEquipmentDetail(EQ);
    expect(result).toHaveLength(1);
    // `employee_id = NULL` nunca es verdadero en SQL: la rama del empleado no agrega filas.
    expect(calls[0]!.sql).toContain('SELECT e.assigned_to_employee_id');
  });

  it('el ICCID no viaja, ni siquiera para quien puede escribir líneas', async () => {
    const { service } = setup([row('SIM-001')]);
    const result = await service.forEquipmentDetail(EQ);
    expect('iccid' in result[0]!).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/8952140000000000001|iccid/i);
  });

  it('identifica a qué equipo está ligada cada línea (para "Este equipo" / "Sin equipo")', async () => {
    const { service } = setup([
      row('SIM-001'),
      row('SIM-004', { equipment_id: EQ, equipment_display_id: 'TEC-2026-284' }),
    ]);
    const [sinEquipo, esteEquipo] = await service.forEquipmentDetail(EQ);
    expect(sinEquipo!.equipment).toBeNull();
    expect(esteEquipo!.equipment).toMatchObject({ id: EQ, displayId: 'TEC-2026-284' });
  });
});

describe('Permiso del endpoint for-equipment', () => {
  const proto = SimCardsController.prototype as any;
  it('exige transformacion.sim-cards.read (sin permiso, 403 y no se devuelve nada)', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.forEquipmentDetail)).toEqual({
      section: 'transformacion',
      module: 'sim-cards',
      action: 'read',
    });
  });

  it('se declara antes de :id para que no lo tome por un id', () => {
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('forEquipmentDetail')).toBeLessThan(order.indexOf('get'));
  });
});
