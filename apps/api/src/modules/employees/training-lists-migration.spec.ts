import { ExtendTrainingLists1751000000049 as Migration } from '../../database/migrations/1751000000049-ExtendTrainingLists';

/** QueryRunner simulado: registra el SQL y responde el conteo de filas con valores nuevos. */
function runner(counts = { tipos: 0, niveles: 0, unidades: 0 }) {
  const sql: string[] = [];
  const qr = {
    query: jest.fn(async (q: string) => {
      sql.push(q);
      return /COUNT\(\*\)/.test(q) ? [counts] : [];
    }),
  };
  return { qr, sql };
}

describe('Migración 049 · listas de capacitaciones', () => {
  it('up: reemplaza los tres CHECK con nombre explícito y los valores ampliados', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const adds = sql.filter((q) => /ADD CONSTRAINT/.test(q));
    expect(adds).toHaveLength(3);
    expect(adds[0]).toContain("chk_training_development_type CHECK (development_type IN ('tecnico','habilidades_blandas','academico','sgsi','bienestar_psicosocial'))");
    expect(adds[1]).toContain("chk_training_level CHECK (level IN ('basico','intermedio','avanzado','especializacion','obligatoria'))");
    expect(adds[2]).toContain("chk_training_duration_unit CHECK (duration_unit IN ('horas','dias','meses'))");
  });

  it('up: busca los CHECK en pg_constraint por columna y NO toca chk_training_dates ni chk_training_duration_pair', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const drops = sql.filter((q) => /FROM pg_constraint/.test(q));
    expect(drops).toHaveLength(3);
    for (const d of drops) expect(d).toContain("conname NOT IN ('chk_training_dates', 'chk_training_duration_pair')");
    expect(drops.map((d) => /\\m(\w+)\\M/.exec(d)?.[1])).toEqual(['development_type', 'level', 'duration_unit']);
    // nunca borra por nombre fijo esos dos CHECK
    expect(sql.some((q) => /DROP CONSTRAINT (IF EXISTS )?chk_training_(dates|duration_pair)/.test(q))).toBe(false);
  });

  it('up no cambia datos (sin UPDATE, INSERT ni DELETE)', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    expect(sql.some((q) => /^\s*(UPDATE|INSERT|DELETE)/i.test(q))).toBe(false);
  });

  it('down: sin filas con valores nuevos vuelve a los CHECK originales', async () => {
    const { qr, sql } = runner();
    await new Migration().down(qr as never);
    const adds = sql.filter((q) => /ADD CONSTRAINT/.test(q));
    expect(adds[0]).toContain("employee_trainings_development_type_check CHECK (development_type IN ('tecnico','habilidades_blandas','academico'))");
    expect(adds[1]).toContain("employee_trainings_level_check CHECK (level IN ('basico','intermedio','avanzado','especializacion'))");
    expect(adds[2]).toContain("employee_trainings_duration_unit_check CHECK (duration_unit IN ('horas','meses'))");
  });

  it('down: con filas que usan valores nuevos aborta con un mensaje claro y no toca nada', async () => {
    const { qr, sql } = runner({ tipos: 2, niveles: 1, unidades: 3 });
    await expect(new Migration().down(qr as never)).rejects.toThrow(/No se puede revertir la migración 049.*SGSI o Bienestar: 2.*Obligatoria: 1.*Días: 3/);
    expect(sql.some((q) => /ADD CONSTRAINT|DROP CONSTRAINT|UPDATE|DELETE/.test(q))).toBe(false);
  });
});
