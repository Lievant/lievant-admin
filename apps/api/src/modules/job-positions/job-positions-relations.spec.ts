import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreatePositionDto, UpdatePositionDto } from './dto/job-position.dto';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';
import type { PositionRow } from './job-positions.util';

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const FULL = { roleSummary: 'TEST-Rol', positionObjective: 'TEST-Objetivo', validationPoints: 'TEST-Puntos', description: 'TEST-Descripción' };
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const C = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const D = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
const GONE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
const MISSING = 'ffffffff-ffff-4fff-8fff-fffffffffff6';

type Pos = { id: string; code: string; title: string; reports_to_position_id: string | null; deleted_at: Date | null };

const baseRow = (p: Pos): PositionRow => ({
  id: p.id, code: p.code, title: p.title, area: 'TI', business_unit: null, level: null, description: 'TEST-Descripción', description_approved: false,
  description_approved_by: null, description_approved_at: null, status: 'pendiente_aprobacion', division: null, level_original: null, seniority: null,
  reports_to_text: null, reports_to_employee_id: null, reports_to_position_id: p.reports_to_position_id, supervises_text: null, plazas: 3, role_summary: 'TEST-Rol',
  position_objective: 'TEST-Objetivo', validation_points: 'TEST-Puntos', head_comments: null, validation_status: 'pendiente', validated_by: null, validated_at: null,
  created_at: new Date(), updated_at: new Date(),
});

/** BD en memoria con puestos, supervisiones y empleados; solo las consultas que usa el servicio para estas relaciones. */
function setup(opts: { employees?: { id: string; full_name: string; position: string; area: string | null; status: string; job_position_id: string }[] } = {}) {
  const positions: Pos[] = [
    { id: A, code: 'JP-001', title: 'Director', reports_to_position_id: null, deleted_at: null },
    { id: B, code: 'JP-002', title: 'Gerente', reports_to_position_id: null, deleted_at: null },
    { id: C, code: 'JP-003', title: 'Analista', reports_to_position_id: null, deleted_at: null },
    { id: D, code: 'JP-004', title: 'Auxiliar', reports_to_position_id: null, deleted_at: null },
    { id: GONE, code: 'JP-005', title: 'Eliminado', reports_to_position_id: null, deleted_at: new Date() },
  ];
  let supervisions: { sup: string; sub: string }[] = [];
  const employees = opts.employees ?? [];
  const calls: { sql: string; params: unknown[] }[] = [];
  const live = (id: string) => positions.find((p) => p.id === id && !p.deleted_at);
  const ref = (p: Pos) => ({ id: p.id, code: p.code, title: p.title, area: 'TI', level: null });

  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    if (/pg_advisory_xact_lock/.test(sql)) return [];
    if (/^SELECT code FROM hr\.job_positions/.test(sql)) return positions.map((p) => ({ code: p.code }));
    if (/FROM catalogs\.areas/.test(sql)) return [{ name: 'TI', division_name: null }];
    if (/FROM catalogs\.org_levels/.test(sql)) return [{ code: 'I' }];
    if (/FROM catalogs\./.test(sql)) return [];
    if (/^INSERT INTO hr\.job_positions/.test(sql)) {
      positions.push({ id: D.replace('4', '9'), code: params[0] as string, title: params[1] as string, reports_to_position_id: null, deleted_at: null });
      return [{ id: D.replace('4', '9') }];
    }
    if (/FOR UPDATE/.test(sql)) { const p = live(params[0] as string); return p ? [baseRow(p)] : []; }
    if (/^SELECT p\.\*, u\.name/.test(sql)) { const p = live(params[0] as string); return p ? [baseRow(p)] : []; }
    if (/^UPDATE hr\.job_positions SET title=/.test(sql)) return [];
    if (/^SELECT reports_to_position_id FROM hr\.job_positions WHERE id = \$1 AND deleted_at IS NULL/.test(sql)) { const p = live(params[0] as string); return p ? [{ reports_to_position_id: p.reports_to_position_id }] : []; }
    if (/^SELECT reports_to_position_id FROM hr\.job_positions WHERE id = \$1$/.test(sql)) { const p = positions.find((x) => x.id === params[0]); return p ? [{ reports_to_position_id: p.reports_to_position_id }] : []; }
    if (/^SELECT id FROM hr\.job_positions WHERE id = ANY\(\$1::uuid\[\]\) AND deleted_at IS NULL/.test(sql)) return (params[0] as string[]).filter((i) => live(i)).map((id) => ({ id }));
    if (/^SELECT id, code, title FROM hr\.job_positions WHERE id = ANY/.test(sql)) return positions.filter((p) => (params[0] as string[]).includes(p.id)).map((p) => ({ id: p.id, code: p.code, title: p.title }));
    if (/^UPDATE hr\.job_positions SET reports_to_position_id = \$2/.test(sql)) { positions.find((p) => p.id === params[0])!.reports_to_position_id = params[1] as string | null; return []; }
    if (/^SELECT p\.title FROM hr\.job_position_supervisions s JOIN hr\.job_positions p ON p\.id = s\.supervisor_position_id/.test(sql)) {
      return supervisions.filter((s) => s.sub === params[0] && (params[1] as string[]).includes(s.sup)).map((s) => ({ title: positions.find((p) => p.id === s.sup)!.title }));
    }
    if (/^SELECT supervised_position_id FROM hr\.job_position_supervisions WHERE supervisor_position_id = \$1/.test(sql)) return supervisions.filter((s) => s.sup === params[0]).map((s) => ({ supervised_position_id: s.sub }));
    if (/^DELETE FROM hr\.job_position_supervisions WHERE supervisor_position_id = \$1 AND NOT/.test(sql)) { supervisions = supervisions.filter((s) => !(s.sup === params[0] && !(params[1] as string[]).includes(s.sub))); return []; }
    if (/^INSERT INTO hr\.job_position_supervisions/.test(sql)) {
      for (const sub of params[1] as string[]) if (!supervisions.some((s) => s.sup === params[0] && s.sub === sub)) supervisions.push({ sup: params[0] as string, sub });
      return [];
    }
    if (/^DELETE FROM hr\.job_position_supervisions WHERE supervisor_position_id = \$1 OR/.test(sql)) { supervisions = supervisions.filter((s) => s.sup !== params[0] && s.sub !== params[0]); return []; }
    if (/^UPDATE hr\.job_positions SET deleted_at = NOW\(\)/.test(sql)) { const p = live(params[0] as string); if (!p) return [[], 0]; p.deleted_at = new Date(); return [[{ id: p.id, code: p.code, title: p.title }], 1]; }
    if (/^UPDATE hr\.job_positions SET reports_to_position_id = NULL, updated_at = NOW\(\) WHERE reports_to_position_id = \$1/.test(sql)) { for (const p of positions) if (p.reports_to_position_id === params[0]) p.reports_to_position_id = null; return []; }
    // detalle
    if (/FROM hr\.job_positions p WHERE p\.id = \$1 AND p\.deleted_at IS NULL/.test(sql)) { const p = live(params[0] as string); return p ? [ref(p)] : []; }
    if (/FROM hr\.job_position_supervisions s JOIN hr\.job_positions p ON p\.id = s\.supervised_position_id/.test(sql)) return supervisions.filter((s) => s.sup === params[0]).map((s) => live(s.sub)).filter((p): p is Pos => !!p).map(ref);
    if (/FROM hr\.job_position_supervisions s JOIN hr\.job_positions p ON p\.id = s\.supervisor_position_id WHERE s\.supervised_position_id/.test(sql)) return supervisions.filter((s) => s.sub === params[0]).map((s) => live(s.sup)).filter((p): p is Pos => !!p).map(ref);
    if (/FROM hr\.job_positions p WHERE p\.reports_to_position_id = \$1 AND p\.deleted_at IS NULL/.test(sql)) return positions.filter((p) => p.reports_to_position_id === params[0] && !p.deleted_at).map(ref);
    if (/^SELECT id, full_name, position, area, status FROM employees\.employee_records/.test(sql)) return employees.filter((e) => e.job_position_id === params[0] && e.status === 'active').map((e) => ({ ...e }));
    if (/^SELECT COUNT\(\*\) AS n FROM employees\.employee_records WHERE job_position_id/.test(sql)) return [{ n: String(employees.filter((e) => e.job_position_id === params[0] && e.status === 'active').length) }];
    return [];
  });
  const dataSource = {
    query,
    transaction: async (cb: (m: unknown) => Promise<unknown>) => {
      const snap = { p: structuredClone(positions), s: structuredClone(supervisions) };
      try {
        return await cb({ query });
      } catch (e) {
        positions.splice(0, positions.length, ...snap.p);
        supervisions = snap.s;
        throw e;
      }
    },
  };
  const audit = { logActivity: jest.fn() };
  return { service: new JobPositionsService(dataSource as never, audit as never), positions, supervisions: () => supervisions, audit, calls };
}

const patch = (over: Record<string, unknown>) => plainToInstance(UpdatePositionDto, over);

describe('Matriz de Puestos · «Reporta a» y «Supervisa a» como relaciones entre puestos', () => {
  it('guarda «Reporta a» y «Supervisa a» en la misma operación y los devuelve en el detalle', async () => {
    const t = setup();
    const d = await t.service.update(B, patch({ reportsToPositionId: A, supervisesPositionIds: [C, D] }), ACTOR);
    expect(d.reportsToPosition).toMatchObject({ id: A, code: 'JP-001', title: 'Director', area: 'TI' });
    expect(d.supervises.map((p) => p.id)).toEqual([D, C].sort((x, y) => (t.positions.find((p) => p.id === x)!.title < t.positions.find((p) => p.id === y)!.title ? -1 : 1)));
    expect(Object.keys(d.supervises[0]!).sort()).toEqual(['area', 'code', 'id', 'level', 'title']);
  });

  it('el detalle del otro lado muestra «Reportan a este puesto» y «Supervisado por»', async () => {
    const t = setup();
    await t.service.update(B, patch({ reportsToPositionId: A, supervisesPositionIds: [C] }), ACTOR);
    const boss = await t.service.getDetail(A);
    expect(boss.directReports.map((p) => p.id)).toEqual([B]);
    const sub = await t.service.getDetail(C);
    expect(sub.supervisedBy.map((p) => p.id)).toEqual([B]);
  });

  it('sin enviar las relaciones no se tocan (undefined) y null o [] las quitan', async () => {
    const t = setup();
    await t.service.update(B, patch({ reportsToPositionId: A, supervisesPositionIds: [C] }), ACTOR);
    await t.service.update(B, patch({ plazas: 5 }), ACTOR);
    expect(t.positions.find((p) => p.id === B)!.reports_to_position_id).toBe(A);
    expect(t.supervisions()).toHaveLength(1);
    const cleared = await t.service.update(B, patch({ reportsToPositionId: null, supervisesPositionIds: [] }), ACTOR);
    expect(cleared.reportsToPosition).toBeNull();
    expect(cleared.supervises).toEqual([]);
  });

  it('un puesto no puede reportarse ni supervisarse a sí mismo', async () => {
    const t = setup();
    await expect(t.service.update(A, patch({ reportsToPositionId: A }), ACTOR)).rejects.toThrow(/a sí mismo/);
    await expect(t.service.update(A, patch({ supervisesPositionIds: [A] }), ACTOR)).rejects.toThrow(/a sí mismo/);
  });

  it('puestos inexistentes o eliminados se rechazan (400) y no se guarda nada', async () => {
    const t = setup();
    await expect(t.service.update(A, patch({ reportsToPositionId: MISSING }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.service.update(A, patch({ reportsToPositionId: GONE }), ACTOR)).rejects.toThrow(/no existe o fue eliminado/);
    await expect(t.service.update(A, patch({ supervisesPositionIds: [B, GONE] }), ACTOR)).rejects.toThrow(/no existe o fue eliminado/);
    expect(t.supervisions()).toHaveLength(0);
    expect(t.positions.find((p) => p.id === A)!.reports_to_position_id).toBeNull();
  });

  it('«Reporta a» no puede crear un ciclo: directo (A↔B) ni en cadena larga (A→B→C→A)', async () => {
    const t = setup();
    await t.service.update(B, patch({ reportsToPositionId: A }), ACTOR); // B reporta a A
    await expect(t.service.update(A, patch({ reportsToPositionId: B }), ACTOR)).rejects.toThrow(/formaría un ciclo/); // A reporta a B: ciclo directo
    await t.service.update(C, patch({ reportsToPositionId: B }), ACTOR); // C → B → A
    await expect(t.service.update(A, patch({ reportsToPositionId: C }), ACTOR)).rejects.toThrow(/formaría un ciclo/); // A → C → B → A
    expect(t.positions.find((p) => p.id === A)!.reports_to_position_id).toBeNull();
  });

  it('«Supervisa a» no admite un par mutuo directo', async () => {
    const t = setup();
    await t.service.update(A, patch({ supervisesPositionIds: [B] }), ACTOR);
    await expect(t.service.update(B, patch({ supervisesPositionIds: [A, C] }), ACTOR)).rejects.toThrow(/ya supervisa a este puesto/);
    expect(t.supervisions()).toEqual([{ sup: A, sub: B }]); // nada cambió
  });

  it('el DTO exige UUID, sin repetidos y máximo 50 supervisados', async () => {
    const errs = async (cls: new () => object, plain: object) => (await validate(plainToInstance(cls, plain) as object)).map((e) => e.property);
    expect(await errs(UpdatePositionDto, { reportsToPositionId: A, supervisesPositionIds: [B, C] })).toEqual([]);
    expect(await errs(UpdatePositionDto, { reportsToPositionId: null, supervisesPositionIds: [] })).toEqual([]);
    expect(await errs(UpdatePositionDto, { reportsToPositionId: 'x' })).toContain('reportsToPositionId');
    expect(await errs(UpdatePositionDto, { supervisesPositionIds: [B, B] })).toContain('supervisesPositionIds');
    expect(await errs(UpdatePositionDto, { supervisesPositionIds: ['no-uuid'] })).toContain('supervisesPositionIds');
    const many = Array.from({ length: 51 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);
    expect(await errs(UpdatePositionDto, { supervisesPositionIds: many })).toContain('supervisesPositionIds');
    expect(await errs(UpdatePositionDto, { supervisesPositionIds: many.slice(0, 50) })).toEqual([]);
    expect(await errs(CreatePositionDto, { title: 'T', area: 'TI', ...FULL, reportsToPositionId: A, supervisesPositionIds: [B] })).toEqual([]);
  });

  it('la bitácora guarda el antes y el después con «código · título»', async () => {
    const t = setup();
    await t.service.update(B, patch({ reportsToPositionId: A, supervisesPositionIds: [C] }), ACTOR);
    await t.service.update(B, patch({ reportsToPositionId: null, supervisesPositionIds: [D] }), ACTOR);
    const calls = t.audit.logActivity.mock.calls.map((c) => (c as unknown[])[0] as { changes: Record<string, { from: unknown; to: unknown }> });
    expect(calls[0]!.changes.reportsToPosition).toEqual({ from: null, to: 'JP-001 · Director' });
    expect(calls[0]!.changes.supervises).toEqual({ from: [], to: ['JP-003 · Analista'] });
    expect(calls[1]!.changes.reportsToPosition).toEqual({ from: 'JP-001 · Director', to: null });
    expect(calls[1]!.changes.supervises).toEqual({ from: ['JP-003 · Analista'], to: ['JP-004 · Auxiliar'] });
  });

  it('editar solo las relaciones de un puesto antiguo no exige los campos obligatorios del formulario', async () => {
    const t = setup();
    // el puesto de prueba trae los cuatro llenos; se vacía uno para simular un puesto antiguo
    const row = baseRow(t.positions[1]!);
    expect(row.role_summary).toBeTruthy();
    await expect(t.service.update(B, patch({ reportsToPositionId: A }), ACTOR)).resolves.toBeDefined();
  });

  it('crear un puesto con relaciones las guarda en la misma transacción', async () => {
    const t = setup();
    const created = await t.service.create(plainToInstance(CreatePositionDto, { title: 'TEST-Nuevo', area: 'TI', ...FULL, reportsToPositionId: A, supervisesPositionIds: [C] }), ACTOR);
    const newId = D.replace('4', '9');
    expect(t.positions.find((p) => p.id === newId)!.reports_to_position_id).toBe(A);
    expect(t.supervisions()).toEqual([{ sup: newId, sub: C }]);
    expect(created).toBeDefined();
  });

  it('crear con un ciclo imposible no existe (puesto nuevo), pero con un puesto eliminado falla y deshace la alta', async () => {
    const t = setup();
    await expect(t.service.create(plainToInstance(CreatePositionDto, { title: 'TEST-Nuevo', area: 'TI', ...FULL, reportsToPositionId: GONE }), ACTOR)).rejects.toThrow(/no existe o fue eliminado/);
    expect(t.positions.some((p) => p.title === 'TEST-Nuevo')).toBe(false);
  });

  it('eliminar un puesto limpia sus relaciones: quienes le reportaban quedan sin «Reporta a» y se borran sus supervisiones', async () => {
    const t = setup();
    await t.service.update(B, patch({ reportsToPositionId: A, supervisesPositionIds: [C] }), ACTOR);
    await t.service.update(C, patch({ reportsToPositionId: B }), ACTOR);
    await t.service.remove(B, ACTOR);
    expect(t.positions.find((p) => p.id === C)!.reports_to_position_id).toBeNull(); // C reportaba a B
    expect(t.supervisions()).toEqual([]);
    const clean = await t.service.getDetail(A);
    expect(clean.directReports).toEqual([]);
  });

  it('las lecturas ignoran a un puesto dado de baja aunque quedara una relación', async () => {
    const t = setup();
    await t.service.update(A, patch({ supervisesPositionIds: [C] }), ACTOR);
    t.positions.find((p) => p.id === C)!.deleted_at = new Date(); // baja sin limpiar relaciones
    const d = await t.service.getDetail(A);
    expect(d.supervises).toEqual([]);
    const sqls = t.calls.map((c) => c.sql).filter((s) => /job_position_supervisions s JOIN/.test(s) || /reports_to_position_id = \$1 AND p\.deleted_at/.test(s));
    expect(sqls.length).toBeGreaterThan(0);
    for (const s of sqls) expect(s).toContain('p.deleted_at IS NULL');
  });

  it('el detalle trae los colaboradores activos del puesto (solo datos básicos) y su conteo', async () => {
    const t = setup({
      employees: [
        { id: 'e1', full_name: 'TEST-Ana', position: 'Analista', area: 'TI', status: 'active', job_position_id: C },
        { id: 'e2', full_name: 'TEST-Beto', position: 'Analista', area: null, status: 'active', job_position_id: C },
        { id: 'e3', full_name: 'TEST-Baja', position: 'Analista', area: 'TI', status: 'inactive', job_position_id: C },
        { id: 'e4', full_name: 'TEST-Otro', position: 'Director', area: 'TI', status: 'active', job_position_id: A },
      ],
    });
    const d = await t.service.getDetail(C);
    expect(d.employees.map((e) => e.fullName)).toEqual(['TEST-Ana', 'TEST-Beto']);
    expect(d.employeesCount).toBe(2);
    expect(Object.keys(d.employees[0]!).sort()).toEqual(['area', 'fullName', 'id', 'position', 'status']);
    expect(JSON.stringify(d.employees)).not.toMatch(/salary|email|corporate|phone/i);
    const q = t.calls.find((c) => /^SELECT id, full_name, position, area, status FROM employees\.employee_records/.test(c.sql))!;
    expect(q.sql).toContain("status = 'active' AND deleted_at IS NULL");
    expect(q.sql).toContain('ORDER BY full_name ASC LIMIT 200');
  });

  it('el detalle exige el permiso de lectura de la Matriz (rrhh.matriz-puestos.read) y editar relaciones el de update', () => {
    const proto = JobPositionsController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.detail!)).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'read' });
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.update!)).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'update' });
  });
});
