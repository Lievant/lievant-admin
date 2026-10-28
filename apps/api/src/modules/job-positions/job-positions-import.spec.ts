import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { JobPositionActivitiesService } from './job-position-activities.service';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsImportService } from './job-positions-import.service';

/** Memoria que imita lo que el servicio le pide a la base (solo las consultas de la importación). */
type Row = Record<string, unknown>;
class FakeDb {
  positions: Row[] = [];
  activities: Row[] = [];
  okrs: Row[] = [];
  kpis: Row[] = [];
  areas: Row[] = [];
  levelCodes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  calls: { sql: string; params: unknown[] }[] = [];
  failOn: RegExp | null = null;
  private seq = 0;
  private id = (p: string) => `${p}-${++this.seq}`;

  get writes() {
    return this.calls.filter((c) => /^(INSERT|UPDATE)/.test(c.sql));
  }

  async transaction<T>(cb: (m: FakeDb) => Promise<T>): Promise<T> {
    const snap = structuredClone({ positions: this.positions, activities: this.activities, okrs: this.okrs, kpis: this.kpis, areas: this.areas });
    try {
      return await cb(this);
    } catch (e) {
      Object.assign(this, snap);
      throw e;
    }
  }

  async query(rawSql: string, params: unknown[] = []): Promise<unknown> {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    this.calls.push({ sql, params });
    if (this.failOn && this.failOn.test(sql)) throw new Error('fallo simulado');
    const live = (rows: Row[]) => rows.filter((r) => !r.deleted_at);
    if (/pg_advisory_xact_lock/.test(sql)) return [];
    if (/FROM catalogs\.job_position_levels/.test(sql)) return this.levelCodes.map((code) => ({ code }));
    if (/^SELECT name, division_name FROM catalogs\.areas/.test(sql)) return this.areas.map((a) => ({ ...a }));
    if (/^INSERT INTO catalogs\.areas/.test(sql)) {
      this.areas.push({ name: params[0], division_name: params[1] });
      return [];
    }
    if (/^SELECT \* FROM hr\.job_positions WHERE deleted_at IS NULL/.test(sql)) return live(this.positions).map((r) => ({ ...r }));
    if (/^SELECT code FROM hr\.job_positions/.test(sql)) return this.positions.map((r) => ({ code: r.code }));
    if (/^SELECT group_order.* FROM hr\.job_position_activities/.test(sql)) {
      return live(this.activities).filter((a) => a.job_position_id === params[0]).sort((a, b) => (a.group_order as number) - (b.group_order as number) || (a.sort_order as number) - (b.sort_order as number));
    }
    if (/^SELECT id, objective_code.* FROM hr\.job_position_okrs/.test(sql)) {
      return live(this.okrs).filter((o) => o.job_position_id === params[0] && o.period === null).sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
    }
    if (/^SELECT id, name.* FROM hr\.job_position_kpis/.test(sql)) return live(this.kpis).filter((k) => k.job_position_id === params[0]);

    if (/^INSERT INTO hr\.job_positions/.test(sql)) {
      const [code, title, area, level, createdBy, division, meot, reports, supervises, plazas, role, objective, points, comments, vstatus, vby, vat, levelOriginal, seniority] = params;
      const row: Row = {
        id: this.id('P'), code, title, area, level, status: 'activo', description: null, description_approved: false, business_unit: null, created_by: createdBy,
        division, meot_hierarchy: meot, reports_to_text: reports, supervises_text: supervises, plazas, role_summary: role, position_objective: objective,
        validation_points: points, head_comments: comments, validation_status: vstatus, validated_by: vby, validated_at: vat, level_original: levelOriginal, seniority, deleted_at: null,
      };
      this.positions.push(row);
      return [{ id: row.id }];
    }
    if (/^UPDATE hr\.job_positions SET/.test(sql)) {
      const row = this.positions.find((p) => p.id === params[0])!;
      for (const m of sql.matchAll(/(\w+) = \$(\d+)/g)) row[m[1]!] = params[Number(m[2]) - 1];
      return [];
    }
    if (/^UPDATE hr\.job_position_activities SET deleted_at/.test(sql)) {
      for (const a of this.activities) if (a.job_position_id === params[0] && !a.deleted_at) a.deleted_at = new Date();
      return [];
    }
    if (/^INSERT INTO hr\.job_position_activities/.test(sql)) {
      const [pid, go, gt, so, d, f, n] = params;
      this.activities.push({ id: this.id('A'), job_position_id: pid, group_order: go, group_title: gt, sort_order: so, description: d, frequency: f, note: n, deleted_at: null });
      return [];
    }
    if (/^UPDATE hr\.job_position_okrs SET objective = \$2/.test(sql)) {
      Object.assign(this.okrs.find((o) => o.id === params[0])!, { objective: params[1], key_result: params[2], sort_order: params[3] });
      return [];
    }
    if (/^UPDATE hr\.job_position_okrs SET deleted_at/.test(sql)) {
      this.okrs.find((o) => o.id === params[0])!.deleted_at = new Date();
      return [];
    }
    if (/^INSERT INTO hr\.job_position_okrs/.test(sql)) {
      const [pid, oc, kc, o, k, so] = params;
      this.okrs.push({ id: this.id('O'), job_position_id: pid, period: null, objective_code: oc, kr_code: kc, objective: o, key_result: k, weight: null, sort_order: so, is_active: true, deleted_at: null });
      return [];
    }
    if (/^UPDATE hr\.job_position_kpis SET name = \$2/.test(sql)) {
      Object.assign(this.kpis.find((k) => k.id === params[0])!, { name: params[1], description: params[2], target_value: params[3], measurement_frequency: params[4] });
      return [];
    }
    if (/^UPDATE hr\.job_position_kpis SET deleted_at/.test(sql)) {
      this.kpis.find((k) => k.id === params[0])!.deleted_at = new Date();
      return [];
    }
    if (/^INSERT INTO hr\.job_position_kpis/.test(sql)) {
      const [pid, n, d, t, f] = params;
      this.kpis.push({ id: this.id('K'), job_position_id: pid, name: n, description: d, target_value: t, measurement_frequency: f, deleted_at: null });
      return [];
    }
    throw new Error(`Consulta no prevista en la prueba: ${sql.slice(0, 80)}`);
  }
}

const HEADER = [
  '#', 'Sub-área', 'Puesto', 'Nivel tabular (HC oct-26)', 'Jerarquía (MEOT)', 'Reporta a', 'Supervisa a', 'Plazas ocupadas', 'Rol',
  'Objetivo del puesto (propuesta)', 'Responsabilidades y actividades (frecuencia)', 'OKRs propuestos', 'KPIs propuestos (indicador | meta | frecuencia)',
  'Puntos a validar', 'Estatus validación', 'Comentarios del Head',
];
const row = (area: string, title: string, over: Record<number, string> = {}): string[] => {
  const base = [
    '1', area, title, 'II', 'Operativo', 'TEST-Jefe', 'Nadie', '2', 'TEST-Rol', 'TEST-Objetivo',
    '1. TEST-Grupo.\n   1.1 Hacer algo (Mensual)\n   1.2 Otra cosa (Semanal) - con nota',
    'O1: TEST-Obj uno.\n   KR1: TEST-KR uno.\n   KR2: TEST-KR dos.',
    '• TEST-KPI A | Meta: 1 | Mensual\n• TEST-KPI B | Meta: 2 | Semanal - detalle',
    'TEST-Punto', 'Pendiente', '',
  ];
  Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v));
  return base;
};

async function xlsx(rows: string[][], name = 'Matriz TEST'): Promise<{ buffer: Buffer; originalname: string; size: number }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  ws.addRow(['Matriz de Puestos – División TEST-Ecom · Propuesta']);
  ws.addRow([]);
  ws.addRow(HEADER);
  rows.forEach((r) => ws.addRow(r));
  wb.addWorksheet('Hoja1').addRow(['notas sueltas']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, originalname: 'TEST-matriz.xlsx', size: buffer.length };
}

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const FILE_ROWS = [row('TEST-Marketplace', 'TEST-Analista'), row('TEST-Performance', 'TEST-Gerente (VACANTE)', { 7: '', 2: 'TEST-Gerente (VACANTE)' })];

function setup() {
  const db = new FakeDb();
  const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new JobPositionsImportService(db as never, audit as never);
  return { db, audit, service };
}

describe('Importación de la Matriz · vista previa', () => {
  it('no escribe nada ni audita; dice crear y da los conteos', async () => {
    const { db, audit, service } = setup();
    const r = await service.run('preview', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR);
    expect(db.writes).toEqual([]);
    expect(audit.logActivity).not.toHaveBeenCalled();
    expect(r.applied).toBe(false);
    expect(r.positions.map((p) => p.action)).toEqual(['crear', 'crear']);
    expect(r.summary).toMatchObject({ positions: 2, created: 2, areas: 2, groups: 2, activities: 4, activitiesWithNote: 2, objectives: 2, okrRows: 4, kpis: 4, plazas: 2 });
    expect(r.divisionHint).toBe('TEST-Ecom');
    expect(r.sheet).toBe('Matriz TEST');
  });
});

describe('Importación de la Matriz · aplicar', () => {
  it('crea puestos con código consecutivo, activos y sin descripción; OKRs de plantilla sin periodo ni peso; la vacante con plazas 0', async () => {
    const { db, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR);
    expect(r.applied).toBe(true);
    expect(db.positions.map((p) => [p.code, p.title, p.division, p.status, p.description, p.plazas])).toEqual([
      ['JP-001', 'TEST-Analista', 'TEST-Ecom', 'activo', null, 2],
      ['JP-002', 'TEST-Gerente', 'TEST-Ecom', 'activo', null, 0],
    ]);
    expect(db.positions[0]).toMatchObject({ validation_status: 'pendiente', level: 'II', meot_hierarchy: 'Operativo', role_summary: 'TEST-Rol' });
    expect(db.okrs).toHaveLength(4);
    expect(db.okrs.every((o) => o.period === null && o.weight === null && o.is_active === true)).toBe(true);
    expect(db.okrs.slice(0, 2).map((o) => [o.objective_code, o.kr_code, o.objective])).toEqual([['O1', 'KR1', 'TEST-Obj uno.'], ['O1', 'KR2', 'TEST-Obj uno.']]);
    expect(db.kpis.map((k) => [k.name, k.measurement_frequency, k.description])).toEqual([
      ['TEST-KPI A', 'mensual', null], ['TEST-KPI B', 'semanal', 'detalle'], ['TEST-KPI A', 'mensual', null], ['TEST-KPI B', 'semanal', 'detalle'],
    ]);
    expect(db.activities.filter((a) => a.job_position_id === db.positions[0]!.id).map((a) => [a.frequency, a.note])).toEqual([['mensual', null], ['semanal', 'con nota']]);
  });

  it('audita archivo, división y conteos, y cada área nueva del catálogo', async () => {
    const { audit, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR);
    const calls = audit.logActivity.mock.calls.map((c) => c[0]);
    const imp = calls.find((c) => c.action === 'import');
    expect(imp).toMatchObject({ module: 'matriz-puestos', userId: 'user-1', entityName: 'TEST-matriz.xlsx' });
    expect(imp.changes).toEqual({
      fileName: { from: null, to: 'TEST-matriz.xlsx' }, division: { from: null, to: 'TEST-Ecom' },
      created: { from: null, to: 2 }, updated: { from: null, to: 0 }, unchanged: { from: null, to: 0 }, newAreas: { from: null, to: 2 },
    });
    const areas = calls.filter((c) => c.entityType === 'catalog_area');
    expect(areas.map((c) => c.entityName)).toEqual(['TEST-Ecom · TEST-Marketplace', 'TEST-Ecom · TEST-Performance']);
    expect(areas.every((c) => c.action === 'create')).toBe(true);
  });

  it('es idempotente: la segunda vez todo sale «sin cambios», sin escribir ni duplicar', async () => {
    const { db, service } = setup();
    const file = await xlsx(FILE_ROWS);
    await service.run('apply', 'TEST-Ecom', file, ACTOR);
    const counts = () => [db.positions.length, db.activities.length, db.okrs.length, db.kpis.length];
    const before = counts();
    db.calls.length = 0;
    const again = await service.run('apply', 'TEST-Ecom', file, ACTOR);
    expect(again.positions.map((p) => p.action)).toEqual(['sin cambios', 'sin cambios']);
    expect(again.summary).toMatchObject({ created: 0, updated: 0, unchanged: 2 });
    expect(db.writes).toEqual([]);
    expect(counts()).toEqual(before);
    expect(db.activities.filter((a) => a.deleted_at)).toHaveLength(0);
  });

  it('una reimportación con cambios actualiza CONSERVANDO los id de OKRs y KPIs (lo asignado a colaboradores no se duplica)', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    const okrIds = db.okrs.map((o) => o.id);
    const kpiIds = db.kpis.map((k) => k.id);

    const changed = row('TEST-Marketplace', 'TEST-Analista', {
      11: 'O1: TEST-Obj uno cambiado.\n   KR1: TEST-KR uno.\n   KR3: TEST-KR nuevo.',
      12: '• TEST-KPI A | Meta: 99 | Diario\n• TEST-KPI C | Meta: 3 | Mensual',
      10: '1. TEST-Grupo.\n   1.1 Hacer algo distinto (Anual)',
    });
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([changed]), ACTOR);
    expect(r.positions[0]!.action).toBe('actualizar');
    const liveOkrs = db.okrs.filter((o) => !o.deleted_at);
    expect(liveOkrs.map((o) => [o.objective_code, o.kr_code])).toEqual([['O1', 'KR1'], ['O1', 'KR3']]);
    // KR1 conserva su id y toma el texto nuevo; KR2 se dio de baja; KR3 es nuevo.
    expect(liveOkrs[0]!.id).toBe(okrIds[0]);
    expect(liveOkrs[0]!.objective).toBe('TEST-Obj uno cambiado.');
    expect(db.okrs.find((o) => o.id === okrIds[1])!.deleted_at).toBeTruthy();
    expect(okrIds).not.toContain(liveOkrs[1]!.id);
    const liveKpis = db.kpis.filter((k) => !k.deleted_at);
    expect(liveKpis.map((k) => [k.name, k.target_value, k.measurement_frequency])).toEqual([['TEST-KPI A', '99', 'diario'], ['TEST-KPI C', '3', 'mensual']]);
    expect(liveKpis[0]!.id).toBe(kpiIds[0]);
    // Las actividades se reemplazan por completo.
    const liveActs = db.activities.filter((a) => !a.deleted_at);
    expect(liveActs.map((a) => a.description)).toEqual(['Hacer algo distinto']);
    expect(db.activities.filter((a) => a.deleted_at)).toHaveLength(2);
  });

  it('al actualizar NO toca description, aprobación, status, business_unit ni los OKRs con periodo', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    Object.assign(db.positions[0]!, { description: 'Descripción formal', description_approved: true, description_approved_by: 'u9', status: 'inactivo', business_unit: 'TEST-UN' });
    db.okrs.push({ id: 'O-periodo', job_position_id: db.positions[0]!.id, period: '2026-S1', objective_code: null, kr_code: null, objective: 'Con periodo', key_result: 'x', weight: 50, sort_order: 9, is_active: true, deleted_at: null });

    await service.run('apply', 'TEST-Ecom', await xlsx([row('TEST-Marketplace', 'TEST-Analista', { 3: 'IV', 8: 'TEST-Rol nuevo', 7: '5' })]), ACTOR);
    expect(db.positions[0]).toMatchObject({ level: 'IV', role_summary: 'TEST-Rol nuevo', plazas: 5, description: 'Descripción formal', description_approved: true, description_approved_by: 'u9', status: 'inactivo', business_unit: 'TEST-UN' });
    for (const call of db.writes.filter((c) => /^UPDATE hr\.job_positions/.test(c.sql))) {
      expect(call.sql).not.toMatch(/description|status =|business_unit|description_approved/);
    }
    expect(db.okrs.find((o) => o.id === 'O-periodo')).toMatchObject({ weight: 50, deleted_at: null });
  });

  it('identidad por (división, área, título) sin acentos ni mayúsculas: no duplica; otra división sí crea', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    const again = await service.run('apply', ' test-ECOM ', await xlsx([row(' test-marketplace', 'TEST-ANALISTA ')]), ACTOR);
    // Es el mismo puesto (no se duplica); solo cambia la escritura de mayúsculas, así que se actualiza.
    expect(again.positions[0]!.action).toBe('actualizar');
    expect(db.positions).toHaveLength(1);
    expect(db.positions[0]!.title).toBe('TEST-ANALISTA');
    const other = await service.run('apply', 'TEST-Otra', await xlsx([FILE_ROWS[0]!]), ACTOR);
    expect(other.positions[0]!.action).toBe('crear');
    expect(db.positions).toHaveLength(2);
  });

  it('estatus de validación y comentarios del Head: solo se actualizan si el archivo trae contenido', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    Object.assign(db.positions[0]!, { validation_status: 'validado', validated_by: 'u-head', validated_at: new Date('2026-01-01'), head_comments: 'Comentario del sistema' });

    // Pendiente y sin comentarios en el archivo: se conservan los del sistema.
    const same = await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    expect(same.positions[0]!.action).toBe('sin cambios');
    expect(db.positions[0]).toMatchObject({ validation_status: 'validado', validated_by: 'u-head', head_comments: 'Comentario del sistema' });

    // Comentario nuevo: se actualiza el comentario, el estatus del sistema se conserva.
    await service.run('apply', 'TEST-Ecom', await xlsx([row('TEST-Marketplace', 'TEST-Analista', { 15: 'Comentario nuevo' })]), ACTOR);
    expect(db.positions[0]).toMatchObject({ validation_status: 'validado', head_comments: 'Comentario nuevo' });

    // Estatus distinto de Pendiente: se actualiza y se guarda quién (de la sesión) y cuándo.
    await service.run('apply', 'TEST-Ecom', await xlsx([row('TEST-Marketplace', 'TEST-Analista', { 14: 'Rechazado', 15: 'Comentario nuevo' })]), ACTOR);
    expect(db.positions[0]).toMatchObject({ validation_status: 'rechazado', validated_by: 'user-1' });
    expect(db.positions[0]!.validated_at).toBeInstanceOf(Date);
  });

  it('todo o nada: si falla una escritura a medias no queda nada importado', async () => {
    const { db, audit, service } = setup();
    db.failOn = /^INSERT INTO hr\.job_position_kpis/;
    await expect(service.run('apply', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR)).rejects.toThrow('fallo simulado');
    expect([db.positions.length, db.activities.length, db.okrs.length, db.kpis.length]).toEqual([0, 0, 0, 0]);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('un error bloqueante no importa nada (ni siquiera los puestos buenos) y no audita', async () => {
    const { db, audit, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!, row('', 'TEST-Sin área')]), ACTOR);
    expect(r.applied).toBe(false);
    expect(r.errors).toEqual([{ row: 5, message: 'Falta la Sub-área del puesto «TEST-Sin área»' }]);
    expect(db.writes).toEqual([]);
    expect(db.positions).toHaveLength(0);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('si el archivo no trae la columna de OKRs, no se tocan los OKRs existentes', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([FILE_ROWS[0]!]), ACTOR);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Matriz TEST');
    ws.addRow(['Sub-área', 'Puesto', 'Plazas ocupadas']);
    ws.addRow(['TEST-Marketplace', 'TEST-Analista', '7']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await service.run('apply', 'TEST-Ecom', { buffer, originalname: 'a.xlsx', size: buffer.length }, ACTOR);
    expect(db.positions[0]!.plazas).toBe(7);
    expect(db.okrs.filter((o) => !o.deleted_at)).toHaveLength(2);
    expect(db.kpis.filter((k) => !k.deleted_at)).toHaveLength(2);
    expect(db.activities.filter((a) => !a.deleted_at)).toHaveLength(2);
  });
});

describe('Importación de la Matriz · archivo', () => {
  const run = (file: { buffer: Buffer; originalname: string; size: number } | undefined) => setup().service.run('preview', 'TEST-Ecom', file, ACTOR);

  it('rechaza sin archivo y archivo vacío', async () => {
    await expect(run(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ buffer: Buffer.alloc(0), originalname: 'a.xlsx', size: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rechaza lo que no es .xlsx: por nombre y por contenido (firma ZIP)', async () => {
    const good = await xlsx(FILE_ROWS);
    await expect(run({ ...good, originalname: 'a.csv' })).rejects.toThrow(/\.xlsx/);
    await expect(run({ buffer: Buffer.from('a,b,c\n1,2,3'), originalname: 'a.xlsx', size: 11 })).rejects.toThrow(/\.xlsx/);
    await expect(run({ buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('basura')]), originalname: 'a.xlsx', size: 10 })).rejects.toThrow(/Excel/);
  });
  it('rechaza más de 5 MB', async () => {
    const big = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(5 * 1024 * 1024 + 1)]);
    await expect(run({ buffer: big, originalname: 'a.xlsx', size: big.length })).rejects.toThrow(/5 MB/);
  });
  it('rechaza más de 500 filas', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => row('TEST-Area', `TEST-Puesto ${i}`, { 10: '', 11: '', 12: '' }));
    await expect(run(await xlsx(rows))).rejects.toThrow(/500 filas/);
  });
});

describe('Matriz de Puestos · permisos de las rutas nuevas', () => {
  const proto = JobPositionsController.prototype as unknown as Record<string, unknown>;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n] as object);
  it('importar exige rrhh.matriz-puestos.import; actividades: read para ver y update para escribir', () => {
    expect(perm('importPositions')).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'import' });
    expect(perm('listActivities').action).toBe('read');
    for (const n of ['createActivity', 'updateActivity', 'removeActivity']) expect(perm(n).action).toBe('update');
  });
  it('la ruta de importación se declara antes que las rutas con :id', () => {
    const names = Object.getOwnPropertyNames(JobPositionsController.prototype);
    expect(names.indexOf('importPositions')).toBeLessThan(names.indexOf('detail'));
  });
});

describe('Matriz de Puestos · actividades', () => {
  it('el servicio de actividades audita el alta, el cambio y la baja', async () => {
    const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
    const rows: Record<string, unknown>[] = [];
    const db = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (/FROM hr\.job_positions WHERE id/.test(sql)) return [{ id: 'p1', code: 'JP-001', title: 'TEST' }];
        if (/^\s*INSERT INTO hr\.job_position_activities/.test(sql)) {
          const row = { id: 'a1', job_position_id: 'p1', group_order: params[1], group_title: params[2], sort_order: params[3], description: params[4], frequency: params[5], note: params[6] };
          rows.push(row);
          return [row];
        }
        if (/^\s*SELECT .* FROM hr\.job_position_activities WHERE id/.test(sql)) return [rows[0]];
        if (/^\s*UPDATE hr\.job_position_activities SET group_order/.test(sql)) return [[{ ...rows[0], description: params[4], frequency: params[5] }], 1];
        if (/^\s*UPDATE hr\.job_position_activities SET deleted_at/.test(sql)) return [[{ id: 'a1', group_title: 'G' }], 1];
        return [];
      }),
    };
    const svc = new JobPositionActivitiesService(db as never, audit as never);
    await svc.create('p1', { groupOrder: 1, groupTitle: 'G', description: 'Hacer', frequency: 'diario' }, ACTOR);
    await svc.update('a1', { description: 'Hacer más', frequency: 'semanal' }, ACTOR);
    await svc.remove('a1', ACTOR);
    expect(audit.logActivity.mock.calls.map((c) => c[0].action)).toEqual(['create', 'update', 'delete']);
    expect(audit.logActivity.mock.calls[1]![0].changes).toMatchObject({ frequency: { from: 'diario', to: 'semanal' }, description: { from: 'modificada', to: 'modificada' } });
  });
});

describe('Importación de la Matriz · listas cerradas (nivel, categoría y área)', () => {
  const names = (db: FakeDb) => db.areas.map((a) => a.name);

  it('área nueva: la vista previa avisa y no escribe; al aplicar queda en el catálogo, una sola vez', async () => {
    const { db, service } = setup();
    const prev = await service.run('preview', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR);
    expect(prev.newAreas).toEqual(['TEST-Marketplace', 'TEST-Performance']);
    expect(prev.warnings.filter((w) => /Área nueva/.test(w.message))).toHaveLength(2);
    expect(db.areas).toEqual([]);
    expect(db.writes).toEqual([]);
    await service.run('apply', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR);
    expect(names(db)).toEqual(['TEST-Marketplace', 'TEST-Performance']);
    expect(db.areas.every((a) => a.division_name === 'TEST-Ecom')).toBe(true);
  });

  it('con las áreas ya en el catálogo no hay avisos de área y se usa el nombre canónico', async () => {
    const { db, service } = setup();
    db.areas.push({ name: 'TEST-Marketplace', division_name: 'TEST-Ecom' }, { name: 'TEST-Performance', division_name: 'test-ecom ' });
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([row(' test-marketplace', 'TEST-A'), row('TEST-PERFORMANCE ', 'TEST-B')]), ACTOR);
    expect(r.warnings.filter((w) => /Área nueva/.test(w.message))).toEqual([]);
    expect(r.newAreas).toEqual([]);
    expect(db.positions.map((p) => p.area)).toEqual(['TEST-Marketplace', 'TEST-Performance']);
    expect(db.areas).toHaveLength(2);
  });

  it('«Marketplace» y «marketplace » en el mismo archivo no crean dos áreas', async () => {
    const { db, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([row('Marketplace', 'TEST-A'), row('marketplace ', 'TEST-B'), row('MARKETPLACE', 'TEST-C')]), ACTOR);
    expect(r.newAreas).toEqual(['Marketplace']);
    expect(names(db)).toEqual(['Marketplace']);
    expect(db.positions.map((p) => p.area)).toEqual(['Marketplace', 'Marketplace', 'Marketplace']);
  });

  it('el área de otra división no cuenta: se crea la de esta división', async () => {
    const { db, service } = setup();
    db.areas.push({ name: 'TEST-Marketplace', division_name: 'Otra División' });
    await service.run('apply', 'TEST-Ecom', await xlsx([row('TEST-Marketplace', 'TEST-A')]), ACTOR);
    expect(db.areas).toHaveLength(2);
  });

  it('todo o nada: si falla el alta de un puesto, el área nueva tampoco queda en el catálogo', async () => {
    const { db, service } = setup();
    db.failOn = /^INSERT INTO hr\.job_positions/;
    await expect(service.run('apply', 'TEST-Ecom', await xlsx(FILE_ROWS), ACTOR)).rejects.toThrow('fallo simulado');
    expect(db.areas).toEqual([]);
  });

  it('reimportar el mismo archivo con las áreas ya creadas sigue dando «sin cambios» y sin áreas nuevas', async () => {
    const { db, service } = setup();
    const file = await xlsx(FILE_ROWS);
    await service.run('apply', 'TEST-Ecom', file, ACTOR);
    const again = await service.run('apply', 'TEST-Ecom', file, ACTOR);
    expect(again.positions.map((p) => p.action)).toEqual(['sin cambios', 'sin cambios']);
    expect(again.newAreas).toEqual([]);
    expect(db.areas).toHaveLength(2);
  });

  it('nivel: «iv», « IV » y «4» se leen como IV', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'iv' }), row('A1', 'P2', { 3: ' IV ' }), row('A1', 'P3', { 3: '4' }), row('A1', 'P4', { 3: 'VIII' })]), ACTOR);
    expect(db.positions.map((p) => p.level)).toEqual(['IV', 'IV', 'IV', 'VIII']);
    expect(db.positions[2]!.level_original).toBe('4');
  });

  it('nivel fuera del catálogo: error bloqueante con su fila; no se importa nada', async () => {
    const { db, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1'), row('A1', 'P2', { 3: 'XV' })]), ACTOR);
    expect(r.applied).toBe(false);
    expect(r.errors).toEqual([{ row: 5, message: expect.stringMatching(/El nivel «XV» no está en el catálogo de niveles/) }]);
    expect(db.positions).toHaveLength(0);
  });

  it('nivel ambiguo (rango, «Sin nivel», «Por definir»): queda vacío con aviso y guarda el texto original', async () => {
    const { db, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'V / VI' }), row('A1', 'P2', { 3: 'Sin nivel (MEOT: III)' }), row('A1', 'P3', { 3: 'Por definir' }), row('A1', 'P4', { 3: '' })]), ACTOR);
    expect(r.errors).toEqual([]);
    expect(db.positions.map((p) => [p.level, p.level_original])).toEqual([[null, 'V / VI'], [null, 'Sin nivel (MEOT: III)'], [null, 'Por definir'], [null, null]]);
    expect(r.warnings.filter((w) => /es ambiguo/.test(w.message))).toHaveLength(3);
  });

  it('un nivel elegido a mano no se pisa con un valor ambiguo ni se reporta como cambio; uno válido del archivo sí lo actualiza', async () => {
    const { db, service } = setup();
    await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'V / VI' })]), ACTOR);
    db.positions[0]!.level = 'III'; // elegido a mano en el desplegable
    const same = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'V / VI' })]), ACTOR);
    expect(same.positions[0]!.action).toBe('sin cambios');
    const other = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'Sin nivel' })]), ACTOR);
    expect(other.positions[0]!.action).toBe('sin cambios');
    expect(db.positions[0]).toMatchObject({ level: 'III', level_original: 'V / VI' });
    const valid = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P1', { 3: 'VI' })]), ACTOR);
    expect(valid.positions[0]!.action).toBe('actualizar');
    expect(db.positions[0]).toMatchObject({ level: 'VI', level_original: 'VI' });
  });

  it('categoría: sale de la jerarquía (MEOT); sin coincidencia queda vacía sin bloquear, y no pisa la elegida a mano', async () => {
    const { db, service } = setup();
    const r = await service.run('apply', 'TEST-Ecom', await xlsx([
      row('A1', 'P1', { 4: 'Especialista Semi Senior (MEOT)' }), row('A1', 'P2', { 4: 'Operativo Junior' }),
      row('A1', 'P3', { 4: 'Especialista Senior' }), row('A1', 'P4', { 4: 'Liderazgo Operativo' }),
    ]), ACTOR);
    expect(r.errors).toEqual([]);
    expect(db.positions.map((p) => p.seniority)).toEqual(['semi_senior', 'junior', 'senior', null]);
    db.positions[3]!.seniority = 'senior'; // elegida a mano
    const again = await service.run('apply', 'TEST-Ecom', await xlsx([row('A1', 'P4', { 4: 'Liderazgo Operativo' })]), ACTOR);
    expect(again.positions[0]!.action).toBe('sin cambios');
    expect(db.positions[3]!.seniority).toBe('senior');
  });
});
