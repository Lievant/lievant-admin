import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { EmployeeDevelopmentService } from '../employee-development/employee-development.service';
import { PeriodQueryDto, ReportQueryDto, SaveEvaluationDto } from './dto/okr-evaluations.dto';
import { OkrEvaluationsController } from './okr-evaluations.controller';
import { OkrEvaluationsReportService } from './okr-evaluations-report.service';
import { OkrEvaluationsService } from './okr-evaluations.service';
import { DETAIL_COLUMNS, DETAIL_SHEET, OKR_REPORT_TITLE, SUMMARY_SHEET } from './okr-report-excel';
import {
  EXPORT_MAX_ROWS,
  OKR_SCORE_VISIBLE_TO_EMPLOYEE,
  assertEvaluablePeriod,
  buildReportWhere,
  buildSummary,
  describeFilters,
  deriveStatus,
  evaluablePeriods,
  mergeEvaluation,
  previousPeriod,
  reportFileName,
  simpleAverage,
  validateScore,
  visibleEvaluation,
  weightedAverage,
  type OkrFact,
} from './okr-evaluations.util';

const E1 = '11111111-1111-4111-8111-111111111111';
const OKR1 = '22222222-2222-4222-8222-222222222222';
const ACTOR = { id: 'user-leader', email: 'lider@lievant.com', name: 'Líder' };
const user = (id = 'user-leader') => ({ id, roles: [], userPermissions: [] }) as never;

// ── Periodos evaluables ──────────────────────────────────────────────────────

describe('Evaluación de OKRs · periodos evaluables (hora de México)', () => {
  it('el semestre actual y el inmediato anterior', () => {
    expect(evaluablePeriods(new Date('2026-10-26T18:00:00Z'))).toEqual(['2026-S2', '2026-S1']);
    expect(evaluablePeriods(new Date('2026-03-10T18:00:00Z'))).toEqual(['2026-S1', '2025-S2']);
  });
  it('bordes del 30 de junio y el 1 de julio', () => {
    expect(evaluablePeriods(new Date('2026-06-30T20:00:00Z'))).toEqual(['2026-S1', '2025-S2']);
    expect(evaluablePeriods(new Date('2026-07-01T20:00:00Z'))).toEqual(['2026-S2', '2026-S1']);
    // 1 de julio 05:00 UTC todavía es 30 de junio en CDMX
    expect(evaluablePeriods(new Date('2026-07-01T05:00:00Z'))[0]).toBe('2026-S1');
  });
  it('bordes del 31 de diciembre y el 1 de enero', () => {
    expect(evaluablePeriods(new Date('2026-12-31T20:00:00Z'))).toEqual(['2026-S2', '2026-S1']);
    expect(evaluablePeriods(new Date('2027-01-01T20:00:00Z'))).toEqual(['2027-S1', '2026-S2']);
    // 1 de enero 05:00 UTC todavía es 31 de diciembre en CDMX
    expect(evaluablePeriods(new Date('2027-01-01T05:00:00Z'))[0]).toBe('2026-S2');
  });
  it('periodo anterior', () => {
    expect(previousPeriod('2026-S2')).toBe('2026-S1');
    expect(previousPeriod('2026-S1')).toBe('2025-S2');
    expect(() => previousPeriod('2026-S3')).toThrow(BadRequestException);
  });
  it('periodos más antiguos o futuros son solo lectura: 409', () => {
    const now = new Date('2026-10-26T18:00:00Z');
    expect(() => assertEvaluablePeriod('2026-S2', now)).not.toThrow();
    expect(() => assertEvaluablePeriod('2026-S1', now)).not.toThrow();
    expect(() => assertEvaluablePeriod('2025-S2', now)).toThrow(ConflictException);
    expect(() => assertEvaluablePeriod('2027-S1', now)).toThrow(/solo lectura/);
  });
});

// ── Calificación ─────────────────────────────────────────────────────────────

describe('Evaluación de OKRs · validación de la calificación', () => {
  it('acepta 0, 100 exacto y hasta dos decimales', () => {
    expect(validateScore(0)).toBe(0);
    expect(validateScore(100)).toBe(100);
    expect(validateScore(87.5)).toBe(87.5);
    expect(validateScore(99.99)).toBe(99.99);
  });
  it('rechaza fuera de rango, más de dos decimales y valores que no son número', () => {
    for (const bad of [-0.01, -1, 100.01, 101, 85.555, 0.001, NaN, Infinity, '90', null, undefined]) {
      expect(() => validateScore(bad)).toThrow(BadRequestException);
    }
    expect(() => validateScore(101)).toThrow(/entre 0 y 100/);
    expect(() => validateScore(85.555)).toThrow(/dos decimales/);
  });
  it('estado: completada con calificación; con solo comentarios queda pendiente', () => {
    expect(deriveStatus(0)).toBe('completada'); // 0 es una calificación válida
    expect(deriveStatus(85)).toBe('completada');
    expect(deriveStatus(null)).toBe('pendiente');
  });
  it('mezcla lo guardado con lo recibido: undefined no cambia, null limpia', () => {
    const cur = { score: 80, comments: 'Bien' };
    expect(mergeEvaluation(cur, { comments: 'Mejor' })).toEqual({ score: 80, comments: 'Mejor', status: 'completada' });
    expect(mergeEvaluation(cur, { score: null })).toEqual({ score: null, comments: 'Bien', status: 'pendiente' });
    expect(mergeEvaluation(null, { comments: '  Solo nota ' })).toEqual({ score: null, comments: 'Solo nota', status: 'pendiente' });
    expect(mergeEvaluation(null, { score: 70 })).toEqual({ score: 70, comments: null, status: 'completada' });
  });
  it('exige calificación o comentario, y acota los comentarios a 2 000 caracteres', () => {
    expect(() => mergeEvaluation(null, {})).toThrow(/calificación o un comentario/);
    expect(() => mergeEvaluation({ score: null, comments: 'x' }, { comments: '  ' })).toThrow(BadRequestException);
    expect(() => mergeEvaluation(null, { comments: 'x'.repeat(2001) })).toThrow(/2000/);
    expect(mergeEvaluation(null, { comments: 'x'.repeat(2000) }).comments).toHaveLength(2000);
  });
});

// ── Promedios ────────────────────────────────────────────────────────────────

describe('Evaluación de OKRs · promedios', () => {
  it('ponderado por peso de los OKRs evaluados', () => {
    // (100*60 + 50*40) / 100 = 80
    expect(weightedAverage([{ score: 100, weight: 60 }, { score: 50, weight: 40 }])).toBe(80);
  });
  it('ignora los OKRs sin evaluar (su peso no cuenta)', () => {
    expect(weightedAverage([{ score: 90, weight: 50 }, { score: null, weight: 50 }])).toBe(90);
  });
  it('simple cuando ninguno de los evaluados tiene peso mayor a 0', () => {
    expect(weightedAverage([{ score: 80, weight: null }, { score: 60, weight: 0 }])).toBe(70);
  });
  it('un evaluado sin peso no entra al ponderado si otros sí tienen peso', () => {
    expect(weightedAverage([{ score: 100, weight: 50 }, { score: 0, weight: null }])).toBe(100);
  });
  it('sin evaluados: sin promedio', () => {
    expect(weightedAverage([{ score: null, weight: 50 }])).toBeNull();
    expect(weightedAverage([])).toBeNull();
  });
  it('redondea a dos decimales sin errores de coma flotante', () => {
    expect(weightedAverage([{ score: 100, weight: 33.33 }, { score: 0, weight: 66.67 }])).toBe(33.33);
    expect(simpleAverage([10, 20, null, 25])).toBe(18.33);
    expect(simpleAverage([null])).toBeNull();
  });

  const f = (employeeId: string, area: string | null, period: string, weight: number | null, score: number | null): OkrFact => ({
    employeeId, employeeName: `Emp ${employeeId}`, area, period, weight, score,
  });

  it('por área: promedio simple de los PROMEDIOS por colaborador (quien tiene más OKRs no pesa más)', () => {
    const facts = [
      // A tiene 3 OKRs, todos con 100; B tiene 1 OKR con 0 → promedio por área = (100 + 0) / 2 = 50, no 75
      f('a', 'TI', '2026-S2', 10, 100), f('a', 'TI', '2026-S2', 10, 100), f('a', 'TI', '2026-S2', 10, 100),
      f('b', 'TI', '2026-S2', 10, 0),
    ];
    const s = buildSummary(facts);
    expect(s.byArea).toEqual([{ area: 'TI', period: '2026-S2', average: 50, employees: 2 }]);
    expect(s.average).toBe(50);
  });
  it('por periodo: promedio simple de los promedios por colaborador de ese periodo', () => {
    const s = buildSummary([f('a', 'TI', '2026-S1', 10, 60), f('b', 'TI', '2026-S1', 10, 80), f('a', 'TI', '2026-S2', 10, 100)]);
    expect(s.byPeriod).toEqual([
      { period: '2026-S2', average: 100, employees: 1 },
      { period: '2026-S1', average: 70, employees: 2 },
    ]);
  });
  it('por colaborador: promedio ponderado, avance evaluados / asignados y sin promedio si no hay evaluados', () => {
    const s = buildSummary([f('a', 'TI', '2026-S2', 60, 100), f('a', 'TI', '2026-S2', 40, 50), f('a', 'TI', '2026-S2', 40, null), f('b', 'TI', '2026-S2', 50, null)]);
    const a = s.byEmployee.find((e) => e.employeeId === 'a')!;
    expect(a).toMatchObject({ average: 80, evaluated: 2, assigned: 3 });
    expect(s.byEmployee.find((e) => e.employeeId === 'b')).toMatchObject({ average: null, evaluated: 0, assigned: 1 });
    expect(s.evaluated).toBe(2);
    expect(s.assigned).toBe(4);
    // b no tiene promedio y no cuenta en el del área ni en el general
    expect(s.byArea[0]).toMatchObject({ average: 80, employees: 1 });
    expect(s.average).toBe(80);
  });
  it('sin datos: resumen vacío y sin promedio', () => {
    expect(buildSummary([])).toMatchObject({ evaluated: 0, assigned: 0, average: null, byEmployee: [], byArea: [], byPeriod: [] });
  });
});

// ── Visibilidad (integración con M5) ─────────────────────────────────────────

describe('Evaluación de OKRs · visibilidad de la evaluación', () => {
  const ev = { score: 85, status: 'completada' as const, comments: 'Muy buen trabajo' };

  it('la bandera viene apagada por defecto', () => {
    expect(OKR_SCORE_VISIBLE_TO_EMPLOYEE).toBe(false);
  });
  it('con la bandera apagada el colaborador no recibe score ni comments (ni siquiera las llaves)', () => {
    const out = visibleEvaluation('self', ev, false);
    expect(out).toEqual({});
    expect(Object.keys(out)).toHaveLength(0);
    expect(JSON.stringify(visibleEvaluation('self', ev))).not.toMatch(/85|Muy buen/);
  });
  it('con la bandera encendida recibe la calificación y el estado, pero NUNCA los comentarios', () => {
    const out = visibleEvaluation('self', ev, true);
    expect(out).toEqual({ score: 85, evaluationStatus: 'completada' });
    expect('comments' in out).toBe(false);
  });
  it('RRHH y el líder directo reciben calificación, estado y comentarios', () => {
    for (const v of ['rrhh', 'leader'] as const) {
      expect(visibleEvaluation(v, ev, false)).toEqual({ score: 85, evaluationStatus: 'completada', comments: 'Muy buen trabajo' });
    }
  });
  it('sin evaluación: Pendiente para quien puede verla', () => {
    expect(visibleEvaluation('rrhh', null, false)).toEqual({ score: null, evaluationStatus: 'pendiente', comments: null });
    expect(visibleEvaluation('self', null, true)).toEqual({ score: null, evaluationStatus: 'pendiente' });
  });

  /** M5 end a end con BD simulada: qué viaja en la respuesta según quién consulta. */
  describe('en la respuesta del M5', () => {
    const build = () => {
      const queries: string[] = [];
      const dataSource = {
        query: jest.fn(async (sql: string) => {
          queries.push(sql);
          if (/FROM employees\.employee_records/.test(sql)) return [{ id: E1, position: 'X', job_position_id: null }];
          if (/description_approved/.test(sql) && /hr\.job_positions/.test(sql)) return [];
          if (/status = 'activo'/.test(sql)) return [];
          if (/objective, key_result, weight FROM hr\.employee_okrs/.test(sql)) return [{ id: OKR1, objective: 'Obj', key_result: 'KR', weight: '50.00' }];
          if (/FROM hr\.okr_evaluations/.test(sql)) return [{ employee_okr_id: OKR1, score: '85.00', status: 'completada', comments: 'Muy buen trabajo' }];
          return [];
        }),
      };
      return { service: new EmployeeDevelopmentService(dataSource as never, { logActivity: jest.fn() } as never), queries };
    };

    it('el propio colaborador (bandera apagada): sin score, sin estado, sin comments y ni siquiera se consulta la evaluación', async () => {
      const { service, queries } = build();
      const d = await service.getDevelopment(E1, '2026-S2', 'self');
      expect(d.okrs[0]).toEqual({ id: OKR1, objective: 'Obj', keyResult: 'KR', weight: 50 });
      expect(queries.some((q) => /okr_evaluations/.test(q))).toBe(false);
    });
    it('RRHH y líder: calificación, estado y comentarios, con una sola consulta para todos los OKRs', async () => {
      for (const viewer of ['rrhh', 'leader'] as const) {
        const { service, queries } = build();
        const d = await service.getDevelopment(E1, '2026-S2', viewer);
        expect(d.okrs[0]).toMatchObject({ score: 85, evaluationStatus: 'completada', comments: 'Muy buen trabajo' });
        expect(queries.filter((q) => /okr_evaluations/.test(q))).toHaveLength(1);
      }
    });
    it('la consulta de evaluaciones ignora las eliminadas', async () => {
      const { service, queries } = build();
      await service.getDevelopment(E1, '2026-S2', 'rrhh');
      expect(queries.find((q) => /okr_evaluations/.test(q))).toContain('deleted_at IS NULL');
    });
  });
});

// ── Servicio del líder con BD simulada ───────────────────────────────────────

interface Call { sql: string; params: unknown[] }

function fakeDb(handler: (sql: string, params: unknown[]) => unknown) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return handler(sql, params);
  });
  return { dataSource: { query, transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb({ query })) }, calls };
}

describe('Evaluación de OKRs · servicio del líder', () => {
  const NOW_PERIOD = evaluablePeriods()[0] as string;
  const OLD_PERIOD = '2020-S1';

  interface Opts {
    isDirect?: boolean;
    employeeIsDirectInDb?: boolean;
    okrPeriod?: string | null; // null => el OKR no existe para ese colaborador
    existing?: { score: string | null; comments: string | null } | null;
    leaderOk?: boolean;
  }
  const build = (o: Opts = {}) => {
    const db = fakeDb((sql, params) => {
      if (/FROM hr\.employee_okrs\s+WHERE id = \$1 AND employee_id = \$2/.test(sql)) {
        return o.okrPeriod === null ? [] : [{ id: OKR1, period: o.okrPeriod ?? NOW_PERIOD, objective: 'Obj', key_result: 'KR', weight: '40.00' }];
      }
      if (/SELECT score, comments FROM hr\.okr_evaluations/.test(sql)) return o.existing ? [o.existing] : [];
      if (/INSERT INTO hr\.okr_evaluations/.test(sql)) {
        const [, , , , , , , , score, comments, status] = params as [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, number | null, string | null, string];
        return [{ score: score === null ? null : String(score), comments, status, evaluated_at: score === null ? null : new Date() }];
      }
      if (/FROM employees\.employee_records\s+WHERE id = \$1 AND direct_report_to_id/.test(sql)) {
        return o.employeeIsDirectInDb === false ? [] : [{ id: E1, full_name: 'Ana', position: 'Analista' }];
      }
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    const leaders = {
      resolve: jest.fn(async (userId: string) => {
        if (o.leaderOk === false) throw new ForbiddenException({ code: 'NOT_A_LEADER', message: 'x' });
        return { userId, employeeId: 'leader-emp', fullName: 'Líder', area: 'TI' };
      }),
    };
    const development = { resolveAccess: jest.fn(async () => ({ hasReadPermission: false, isSelf: false, isDirectLeader: o.isDirect !== false })) };
    return { service: new OkrEvaluationsService(db.dataSource as never, audit as never, leaders as never, development as never), db, audit, leaders, development };
  };
  const save = (svc: OkrEvaluationsService, body: object, u = user()) => svc.save(u, E1, OKR1, plainToInstance(SaveEvaluationDto, body), ACTOR);

  it('primer guardado: crea la evaluación (upsert) con los snapshots del OKR asignado y al líder como evaluador', async () => {
    const { service, db } = build();
    const out = await save(service, { score: 90, comments: 'Excelente' });
    const ins = db.calls.find((c) => /INSERT INTO hr\.okr_evaluations/.test(c.sql))!;
    expect(ins.sql).toContain('ON CONFLICT (employee_okr_id)');
    expect(ins.params.slice(0, 8)).toEqual([OKR1, E1, 'leader-emp', 'user-leader', NOW_PERIOD, 'Obj', 'KR', '40.00']);
    expect(out).toMatchObject({ score: 90, comments: 'Excelente', status: 'completada', weight: 40 });
  });

  it('segundo guardado: actualiza por OKR (mismo upsert, sin duplicar) y el evaluador pasa a ser quien guardó', async () => {
    const { service, db } = build({ existing: { score: '70.00', comments: 'Regular' } });
    await save(service, { score: 80 });
    const ins = db.calls.find((c) => /INSERT INTO hr\.okr_evaluations/.test(c.sql))!;
    expect(ins.sql).toContain('DO UPDATE SET');
    expect(ins.sql).toContain('evaluator_employee_id = EXCLUDED.evaluator_employee_id');
    expect(ins.params[9]).toBe('Regular'); // los comentarios guardados se conservan si no se mandan
    expect(db.calls.filter((c) => /INSERT INTO hr\.okr_evaluations/.test(c.sql))).toHaveLength(1);
  });

  it('solo comentario: queda pendiente; con calificación: completada', async () => {
    const note = await save(build().service, { comments: 'Falta evidencia' });
    expect(note).toMatchObject({ score: null, status: 'pendiente', evaluatedAt: null });
    const scored = await save(build().service, { score: 0 });
    expect(scored).toMatchObject({ score: 0, status: 'completada' });
  });

  it('rechaza calificaciones inválidas antes de escribir', async () => {
    for (const body of [{ score: 101 }, { score: -5 }, { score: 80.555 }, {}]) {
      const { service, db } = build();
      await expect(save(service, body)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.calls.some((c) => /INSERT INTO/.test(c.sql))).toBe(false);
    }
  });

  it('periodo no evaluable: 409 y no se escribe', async () => {
    const { service, db, audit } = build({ okrPeriod: OLD_PERIOD });
    await expect(save(service, { score: 90 })).rejects.toBeInstanceOf(ConflictException);
    expect(db.calls.some((c) => /INSERT INTO/.test(c.sql))).toBe(false);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('un OKR que no pertenece al colaborador (o está eliminado o inactivo): 404', async () => {
    const { service, db } = build({ okrPeriod: null });
    await expect(save(service, { score: 90 })).rejects.toBeInstanceOf(NotFoundException);
    expect(db.calls.find((c) => /FROM hr\.employee_okrs\s+WHERE id = \$1 AND employee_id = \$2/.test(c.sql))!.sql).toContain('deleted_at IS NULL');
  });

  it('solo el líder DIRECTO guarda: RRHH, el líder de un nivel superior y otros usuarios reciben 404 y no se escribe nada', async () => {
    // resolveAccess dice que no es líder directo (RRHH con permiso, líder superior u otro)
    const notDirect = build({ isDirect: false });
    await expect(save(notDirect.service, { score: 90 })).rejects.toBeInstanceOf(NotFoundException);
    // aunque resolveAccess dijera que sí, el empleado debe ser realmente su directo y activo
    const notInDb = build({ employeeIsDirectInDb: false });
    await expect(save(notInDb.service, { score: 90 })).rejects.toBeInstanceOf(NotFoundException);
    for (const b of [notDirect, notInDb]) {
      expect(b.db.calls.some((c) => /INSERT INTO|UPDATE/.test(c.sql))).toBe(false);
      expect(b.audit.logActivity).not.toHaveBeenCalled();
    }
  });

  it('un no líder (o sin empleado vinculado) no puede usar nada: 403 antes de tocar la BD', async () => {
    const { service, db } = build({ leaderOk: false });
    await expect(save(service, { score: 90 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.myTeam('u')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.memberOkrs(user(), E1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.periods('u')).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.calls).toHaveLength(0);
  });

  it('reutiliza la regla de acceso del M5 (resolveAccess) y exige líder directo, no solo permiso', async () => {
    const { service, development } = build();
    await save(service, { score: 50 });
    expect(development.resolveAccess).toHaveBeenCalledTimes(1);
  });

  it('auditoría con el valor anterior y el nuevo de la calificación; no guarda el texto de los comentarios', async () => {
    const { service, audit } = build({ existing: { score: '70.00', comments: 'Regular' } });
    await save(service, { score: 85, comments: 'Mejoró mucho' });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'evaluate',
        module: 'okrs',
        entityType: 'okr_evaluation',
        entityId: OKR1,
        userId: 'user-leader',
        changes: { employeeId: E1, period: NOW_PERIOD, score: { from: 70, to: 85 }, commentsChanged: true },
      }),
    );
    expect(JSON.stringify((audit.logActivity.mock.calls[0] as unknown[])[0])).not.toContain('Mejoró mucho');
  });

  it('el primer guardado audita desde null', async () => {
    const { service, audit } = build();
    await save(service, { score: 60 });
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ score: { from: null, to: 60 }, commentsChanged: false }) }));
  });

  it('mi equipo: solo directos, activos y vivos; OKRs activos y no eliminados del periodo; avance evaluados / asignados', async () => {
    const db = fakeDb(() => [{ id: E1, full_name: 'Ana', position: 'Analista', assigned: '5', evaluated: '3' }]);
    const leaders = { resolve: jest.fn(async () => ({ userId: 'u', employeeId: 'leader-emp', fullName: 'L', area: null })) };
    const service = new OkrEvaluationsService(db.dataSource as never, { logActivity: jest.fn() } as never, leaders as never, {} as never);
    const res = await service.myTeam('u', NOW_PERIOD);
    const q = db.calls[0]!;
    expect(q.sql).toContain('e.direct_report_to_id = $1');
    expect(q.sql).toContain("e.status = 'active'");
    expect(q.sql).toContain('e.deleted_at IS NULL');
    expect(q.sql).toContain('o.deleted_at IS NULL AND o.is_active = true');
    expect(q.sql).toContain('ev.deleted_at IS NULL');
    expect(q.params).toEqual(['leader-emp', NOW_PERIOD]);
    expect(res.team[0]).toEqual({ employeeId: E1, fullName: 'Ana', position: 'Analista', assigned: 5, evaluated: 3 });
    expect(res.editable).toBe(true);
    expect((await service.myTeam('u', OLD_PERIOD)).editable).toBe(false);
  });

  it('los OKRs de un colaborador: 404 si no es su directo; solo lectura fuera de los periodos evaluables', async () => {
    const notDirect = build({ isDirect: false });
    await expect(notDirect.service.memberOkrs(user(), E1, NOW_PERIOD)).rejects.toBeInstanceOf(NotFoundException);
    const ok = build();
    expect((await ok.service.memberOkrs(user(), E1, OLD_PERIOD)).editable).toBe(false);
    expect((await ok.service.memberOkrs(user(), E1, NOW_PERIOD)).editable).toBe(true);
  });

  it('los periodos evaluables salen en hora de México', async () => {
    const { service } = build();
    const res = await service.periods('u', new Date('2026-07-01T05:30:00Z'));
    expect(res.periods).toEqual(['2026-S1', '2025-S2']);
  });
});

// ── Reporte de RRHH ──────────────────────────────────────────────────────────

describe('Evaluación de OKRs · reporte de RRHH', () => {
  const dbRow = (over: object = {}) => ({
    employee_id: E1, full_name: 'Ana Pérez', area: 'TI', leader_name: 'Beto Líder', period: '2026-S2',
    objective: 'Obj', key_result: 'KR', weight: '50.00', score: '80.00', status: 'completada', evaluated_at: new Date('2026-10-20T18:00:00Z'), ...over,
  });
  const build = (rows: object[], facts: object[] = rows) => {
    const db = fakeDb((sql) => (/COUNT\(\*\) OVER\(\)/.test(sql) || /LIMIT/.test(sql) ? rows : facts));
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new OkrEvaluationsReportService(db.dataSource as never, audit as never), db, audit };
  };

  it('solo empleados activos y OKRs activos y no eliminados; filtros de periodo, área y colaborador', () => {
    const { where, params } = buildReportWhere({ period: '2026-S2', area: 'TI', employeeId: E1 });
    for (const c of ['o.deleted_at IS NULL', 'o.is_active = true', "e.status = 'active'", 'e.deleted_at IS NULL', 'o.period = $1', 'e.area = $2', 'e.id = $3']) expect(where).toContain(c);
    expect(params).toEqual(['2026-S2', 'TI', E1]);
    expect(buildReportWhere({}).params).toEqual([]);
  });

  it('una consulta paginada (con total en la misma) y otra para los promedios sobre TODO el filtro', async () => {
    const page = [dbRow({ total_count: 60 })];
    const everything = [dbRow({ employee_id: 'a', score: '100.00', weight: '10.00' }), dbRow({ employee_id: 'b', score: '50.00', weight: '10.00' }), dbRow({ employee_id: 'c', score: null })];
    const { service, db } = build(page, everything);
    const res = await service.getReport(plainToInstance(ReportQueryDto, { period: '2026-S2', page: 2, limit: 10 }));
    expect(db.calls).toHaveLength(2);
    const paged = db.calls.find((c) => /LIMIT/.test(c.sql))!;
    expect(paged.sql).toContain('COUNT(*) OVER()');
    expect(paged.params.slice(-2)).toEqual([10, 10]);
    expect(res).toMatchObject({ total: 60, page: 2, limit: 10, totalPages: 6 });
    // el resumen NO sale de la página (1 fila) sino de todo el conjunto (3 filas)
    expect(res.data).toHaveLength(1);
    expect(res.summary.assigned).toBe(3);
    expect(res.summary.evaluated).toBe(2);
    expect(res.summary.average).toBe(75);
    expect(res.summary.byArea[0]).toMatchObject({ area: 'TI', average: 75, employees: 2 });
  });

  it('un OKR sin evaluación sale como Pendiente', async () => {
    const { service } = build([dbRow({ total_count: 1, score: null, status: null, evaluated_at: null })]);
    const res = await service.getReport(plainToInstance(ReportQueryDto, {}));
    expect(res.data[0]).toMatchObject({ score: null, status: 'pendiente' });
  });

  it('el DTO acota página, límite (máx. 100), periodo y colaborador', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(ReportQueryDto, plain))).map((e) => e.property);
    expect(await errs({ period: '2026-S3' })).toContain('period');
    expect(await errs({ limit: 101 })).toContain('limit');
    expect(await errs({ page: 0 })).toContain('page');
    expect(await errs({ employeeId: 'x' })).toContain('employeeId');
    expect(await errs({ period: '2026-S2', limit: 100 })).toEqual([]);
    expect((await validate(plainToInstance(PeriodQueryDto, { period: 'x' }))).length).toBe(1);
  });

  it('el DTO de guardado: rango, decimales y comentarios', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(SaveEvaluationDto, plain))).map((e) => e.property);
    expect(await errs({ score: 100 })).toEqual([]);
    expect(await errs({ score: 0, comments: 'x' })).toEqual([]);
    expect(await errs({ score: 100.5 })).toContain('score');
    expect(await errs({ score: -1 })).toContain('score');
    expect(await errs({ score: 80.123 })).toContain('score');
    expect(await errs({ comments: 'x'.repeat(2001) })).toContain('comments');
    expect(await errs({ score: null })).toEqual([]);
  });

  describe('exportación', () => {
    const load = async (buf: Buffer) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      return wb;
    };

    it('nombre del archivo, hojas Detalle y Resumen, encabezado, filtros y datos', async () => {
      const rows = [dbRow(), dbRow({ employee_id: 'b', full_name: 'Zoe', score: null, status: null, evaluated_at: null })];
      const { service } = build(rows);
      const out = await service.exportExcel(plainToInstance(ReportQueryDto, { period: '2026-S2', area: 'TI' }), ACTOR);
      expect(out.fileName).toBe('OKRs-2026-S2.xlsx');
      const wb = await load(out.buffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual([DETAIL_SHEET, SUMMARY_SHEET]);
      const d = wb.getWorksheet(DETAIL_SHEET)!;
      expect(d.getCell(1, 2).value).toBe(OKR_REPORT_TITLE);
      expect(d.getCell(2, 2).value).toBe('Periodo: 2026-S2');
      expect(String(d.getCell(3, 2).value)).toContain('Área: TI');
      expect(String(d.getCell(4, 2).value)).toMatch(/Generado: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} \(America\/Mexico_City\)/);
      expect(d.getImages().length).toBe(1);
      expect(DETAIL_COLUMNS.map((_, i) => d.getCell(7, i + 1).value)).toEqual([...DETAIL_COLUMNS]);
      expect(d.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
      expect(d.autoFilter).toBeTruthy();
      expect(d.getCell(8, 8).value).toBe(80);
      expect(d.getCell(8, 9).value).toBe('Evaluado');
      expect(d.getCell(8, 10).numFmt).toBe('dd/mm/yyyy');
      expect(d.getCell(9, 9).value).toBe('Pendiente');
      const s = wb.getWorksheet(SUMMARY_SHEET)!;
      const labels: string[] = [];
      s.eachRow((r) => { const v = r.getCell(1).value; if (typeof v === 'string') labels.push(v); });
      for (const t of ['General', 'Por colaborador', 'Por área', 'Por periodo']) expect(labels).toContain(t);
      expect(labels).toContain('Ana Pérez');
    });

    it('sin periodo el archivo se llama OKRs-Todos.xlsx', () => {
      expect(reportFileName(undefined)).toBe('OKRs-Todos.xlsx');
      expect(describeFilters({})).toBe('Periodo: Todos · Área: Todas · Colaborador: Todos');
    });

    it('trae todo el filtro (sin paginar) con el tope de seguridad y audita la exportación con los filtros y el número de filas', async () => {
      const { service, db, audit } = build([dbRow()]);
      await service.exportExcel(plainToInstance(ReportQueryDto, { period: '2026-S2', area: 'TI' }), ACTOR);
      expect(db.calls[0]!.sql).not.toContain('OFFSET');
      expect(db.calls[0]!.params).toEqual(['2026-S2', 'TI', EXPORT_MAX_ROWS + 1]);
      expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'export', module: 'okrs', entityType: 'okr_report', userId: 'user-leader', entityName: 'OKRs-2026-S2.xlsx',
        changes: { filters: { period: '2026-S2', area: 'TI', employeeId: undefined }, rows: 1 },
      }));
    });

    it('por encima del tope: 400 con mensaje claro y sin auditoría', async () => {
      const many = Array.from({ length: EXPORT_MAX_ROWS + 1 }, () => dbRow());
      const { service, audit } = build(many);
      await expect(service.exportExcel(plainToInstance(ReportQueryDto, {}), ACTOR)).rejects.toThrow(/supera 20[.,]000 filas/);
      expect(audit.logActivity).not.toHaveBeenCalled();
    });

    it('consultar el reporte no se audita', async () => {
      const { service, audit } = build([dbRow({ total_count: 1 })]);
      await service.getReport(plainToInstance(ReportQueryDto, {}));
      expect(audit.logActivity).not.toHaveBeenCalled();
    });
  });

  it('las opciones traen periodos con OKRs y áreas, solo de empleados activos y OKRs vivos', async () => {
    const db = fakeDb((sql) => (/o\.period AS v/.test(sql) ? [{ v: '2026-S2' }, { v: '2026-S1' }] : [{ v: 'TI' }]));
    const service = new OkrEvaluationsReportService(db.dataSource as never, { logActivity: jest.fn() } as never);
    expect(await service.getOptions()).toEqual({ periods: ['2026-S2', '2026-S1'], areas: ['TI'] });
    for (const c of db.calls) {
      expect(c.sql).toContain("e.status = 'active'");
      expect(c.sql).toContain('o.deleted_at IS NULL');
    }
  });
});

// ── Permisos y rutas ─────────────────────────────────────────────────────────

describe('Evaluación de OKRs · permisos y rutas', () => {
  const proto = OkrEvaluationsController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n]!);

  it('las rutas de líder son solo de sesión (la verificación de líder directo la hace el servicio)', () => {
    for (const n of ['periods', 'myTeam', 'member', 'save']) expect(perm(n)).toBeNull();
  });
  it('el reporte, sus opciones y la exportación exigen rrhh.okrs.read; no existe ningún permiso para calificar', () => {
    for (const n of ['reportOptions', 'exportReport', 'getReport']) expect(perm(n)).toEqual({ section: 'rrhh', module: 'okrs', action: 'read' });
    const actions = ['reportOptions', 'exportReport', 'getReport'].map((n) => perm(n).action);
    expect(actions).not.toContain('write');
    expect(actions).not.toContain('approve');
  });
  it('las rutas fijas van antes de las que llevan :employeeId', () => {
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('periods')).toBeLessThan(order.indexOf('member'));
    expect(order.indexOf('periods')).toBeLessThan(order.indexOf('myTeam') + 1);
  });
  it('ninguna ruta queda sin decisión de acceso (permiso o sesión explícita)', () => {
    const routes = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    expect(routes.length).toBe(7);
    for (const n of routes) expect(perm(n)).not.toBeUndefined();
  });
});
