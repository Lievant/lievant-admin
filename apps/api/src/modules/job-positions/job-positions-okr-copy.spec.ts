import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CopyOkrsDto } from './dto/job-position.dto';
import { JobPositionItemsService } from './job-position-items.service';
import { JobPositionsController } from './job-positions.controller';

const P1 = '11111111-1111-4111-8111-111111111111';
const ACTOR = { id: 'rrhh-1', email: 'rrhh@lievant.com', name: 'RRHH' };

type Okr = { id: string; job_position_id: string; period: string; objective_code: string | null; kr_code: string | null; objective: string; key_result: string; weight: number; sort_order: number; is_active: boolean; deleted_at: Date | null };

/** BD en memoria con solo lo que usa copyOkrs; la transacción deshace los cambios si el callback falla. */
function setup(initial: Partial<Okr>[], positionExists = true) {
  let seq = 0;
  let okrs: Okr[] = initial.map((o) => ({
    id: `o${++seq}`, job_position_id: P1, period: '2026-S1', objective_code: null, kr_code: null, objective: 'Obj', key_result: 'KR', weight: 10, sort_order: 0, is_active: true, deleted_at: null, ...o,
  }));
  const calls: { sql: string; params: unknown[] }[] = [];
  let failOnInsert = false;
  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    if (/FROM hr\.job_positions WHERE id = \$1 AND deleted_at IS NULL FOR UPDATE/.test(sql)) return positionExists ? [{ id: P1, code: 'JP-001', title: 'TEST' }] : [];
    if (/^SELECT .* FROM hr\.job_position_okrs WHERE job_position_id = \$1 AND period = \$2 AND deleted_at IS NULL AND is_active = true/.test(sql)) {
      return okrs.filter((o) => o.job_position_id === params[0] && o.period === params[1] && !o.deleted_at && o.is_active).map((o) => ({ ...o, weight: String(o.weight) }));
    }
    if (/^SELECT .* FROM hr\.job_position_okrs WHERE job_position_id = \$1 AND period = \$2 AND deleted_at IS NULL$/.test(sql)) {
      return okrs.filter((o) => o.job_position_id === params[0] && o.period === params[1] && !o.deleted_at).map((o) => ({ ...o, weight: String(o.weight) }));
    }
    if (/^INSERT INTO hr\.job_position_okrs/.test(sql)) {
      if (failOnInsert) throw new Error('falla simulada');
      const ids = params[0] as string[];
      for (const src of okrs.filter((o) => ids.includes(o.id))) okrs.push({ ...src, id: `o${++seq}`, period: params[1] as string, is_active: true });
      return [];
    }
    return [];
  });
  const dataSource = {
    query,
    transaction: async (cb: (m: unknown) => Promise<unknown>) => {
      const snap = structuredClone(okrs);
      try {
        return await cb({ query });
      } catch (e) {
        okrs = snap;
        throw e;
      }
    },
  };
  const audit = { logActivity: jest.fn(async () => undefined) };
  return {
    service: new JobPositionItemsService(dataSource as never, audit as never),
    calls,
    audit,
    failInsert: () => { failOnInsert = true; },
    okrs: () => okrs,
  };
}

const dto = (fromPeriod: string, toPeriod: string) => plainToInstance(CopyOkrsDto, { fromPeriod, toPeriod });

describe('Matriz de Puestos · copiar OKRs a otro semestre', () => {
  it('copia los OKRs activos y vivos con códigos, textos, peso y orden, y dice cuántos copió y cuántos omitió', async () => {
    const t = setup([
      { objective_code: 'O1', kr_code: 'KR1', objective: 'A', key_result: 'a', weight: 40, sort_order: 1 },
      { objective_code: 'O1', kr_code: 'KR2', objective: 'A', key_result: 'b', weight: 60, sort_order: 2 },
      { objective_code: 'O9', kr_code: 'KR9', objective: 'inactivo', is_active: false },
      { objective_code: 'O8', kr_code: 'KR8', objective: 'eliminado', deleted_at: new Date() },
    ]);
    const r = await t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR);
    expect(r).toEqual({ fromPeriod: '2026-S1', toPeriod: '2026-S2', copied: 2, skipped: 0 });
    const copies = t.okrs().filter((o) => o.period === '2026-S2');
    expect(copies.map((o) => [o.objective_code, o.kr_code, o.objective, o.key_result, o.weight, o.sort_order, o.is_active])).toEqual([
      ['O1', 'KR1', 'A', 'a', 40, 1, true], ['O1', 'KR2', 'A', 'b', 60, 2, true],
    ]);
    // el origen queda intacto
    expect(t.okrs().filter((o) => o.period === '2026-S1' && !o.deleted_at)).toHaveLength(4 - 1);
  });

  it('omite los que ya existen en el destino por códigos (O+KR) y los que no tienen códigos por texto normalizado', async () => {
    const t = setup([
      { objective_code: 'O1', kr_code: 'KR1', objective: 'A', key_result: 'a', weight: 20 },
      { objective_code: 'O1', kr_code: 'KR2', objective: 'A', key_result: 'b', weight: 20 },
      { objective: 'Reducir Tiempo', key_result: 'En un 10 %', weight: 20 },
      { objective: 'Otro objetivo', key_result: 'Otro KR', weight: 20 },
      // ya en el destino
      { period: '2026-S2', objective_code: 'O1', kr_code: 'KR1', objective: 'redacción distinta', key_result: 'x', weight: 10 },
      { period: '2026-S2', objective: '  reducir   tiempo ', key_result: 'EN UN 10 %', weight: 10 },
    ]);
    const r = await t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR);
    expect(r).toMatchObject({ copied: 2, skipped: 2 });
    expect(t.okrs().filter((o) => o.period === '2026-S2' && !o.deleted_at)).toHaveLength(4);
  });

  it('copiar dos veces no duplica (la segunda omite todo)', async () => {
    const t = setup([{ objective_code: 'O1', kr_code: 'KR1', weight: 30 }, { objective: 'sin códigos', weight: 30 }]);
    expect(await t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).toMatchObject({ copied: 2, skipped: 0 });
    expect(await t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).toMatchObject({ copied: 0, skipped: 2 });
    expect(t.okrs().filter((o) => o.period === '2026-S2')).toHaveLength(2);
  });

  it('tope de 100: si el destino quedaría por encima, error y no copia NADA (todo o nada)', async () => {
    const t = setup([
      { objective_code: 'O1', kr_code: 'KR1', weight: 40 },
      { objective_code: 'O1', kr_code: 'KR2', weight: 40 },
      { period: '2026-S2', objective_code: 'O5', kr_code: 'KR5', weight: 30 },
    ]);
    await expect(t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).rejects.toThrow(/no puede pasar de 100.*quedaría en 110.*No se copió nada/);
    expect(t.okrs().filter((o) => o.period === '2026-S2')).toHaveLength(1);
    expect(t.calls.some((c) => /^INSERT/.test(c.sql))).toBe(false);
    expect(t.audit.logActivity).not.toHaveBeenCalled();
  });

  it('justo 100 se acepta; el destino cuenta solo sus OKRs activos (un inactivo no suma)', async () => {
    const t = setup([
      { objective_code: 'O1', kr_code: 'KR1', weight: 60 },
      { period: '2026-S2', objective_code: 'O5', kr_code: 'KR5', weight: 40 },
      { period: '2026-S2', objective_code: 'O6', kr_code: 'KR6', weight: 90, is_active: false },
    ]);
    await expect(t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).resolves.toMatchObject({ copied: 1 });
  });

  it('una falla al escribir deshace todo (transacción) y no deja bitácora', async () => {
    const t = setup([{ objective_code: 'O1', kr_code: 'KR1', weight: 30 }]);
    t.failInsert();
    await expect(t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).rejects.toThrow('falla simulada');
    expect(t.okrs().filter((o) => o.period === '2026-S2')).toHaveLength(0);
    expect(t.audit.logActivity).not.toHaveBeenCalled();
  });

  it('semestres inválidos o iguales se rechazan antes de tocar la base', async () => {
    const t = setup([]);
    for (const [a, b] of [['2026-S1', '2026-S1'], ['base', '2026-S2'], ['2026-S1', '2026-S3'], ['', '2026-S2']]) {
      await expect(t.service.copyOkrs(P1, dto(a!, b!), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(t.calls).toHaveLength(0);
  });

  it('un puesto inexistente o eliminado: 404', async () => {
    const t = setup([], false);
    await expect(t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deja bitácora de auditoría con origen, destino, copiados y omitidos', async () => {
    const t = setup([{ objective_code: 'O1', kr_code: 'KR1', weight: 30 }]);
    await t.service.copyOkrs(P1, dto('2026-S1', '2026-S2'), ACTOR);
    expect(t.audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'copy', module: 'matriz-puestos', entityType: 'job_position_okr', entityId: P1, entityName: 'JP-001 · 2026-S1 → 2026-S2',
      changes: expect.objectContaining({ copied: { from: null, to: 1 }, skipped: { from: null, to: 0 } }),
    }));
  });

  it('el DTO exige los dos semestres con formato AAAA-S1/S2', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(CopyOkrsDto, plain))).map((e) => e.property).sort();
    expect(await errs({ fromPeriod: '2026-S1', toPeriod: '2027-S2' })).toEqual([]);
    expect(await errs({})).toEqual(['fromPeriod', 'toPeriod']);
    expect(await errs({ fromPeriod: 'base', toPeriod: '2026-S3' })).toEqual(['fromPeriod', 'toPeriod']);
  });

  it('la ruta exige el mismo permiso que editar OKRs de la Matriz (matriz-puestos.update)', () => {
    const proto = JobPositionsController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.copyOkrs!)).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'update' });
    expect(Reflect.getMetadata('path', proto.copyOkrs!)).toBe('job-positions/:id/okrs/copy');
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.createOkr!)).toEqual(Reflect.getMetadata(PERMISSION_KEY, proto.copyOkrs!));
  });
});
