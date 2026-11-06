import { JobPositionRelations1751000000051 as Migration } from '../../database/migrations/1751000000051-JobPositionRelations';

/** QueryRunner simulado: registra el SQL y responde los conteos del PRE y los puestos rellenados. */
function runner(opts: { filled?: string[]; cycleBroken?: string[] } = {}) {
  const sql: string[] = [];
  const qr = {
    query: jest.fn(async (q: string) => {
      sql.push(q);
      if (/RETURNING p\.id/.test(q) && /WITH RECURSIVE/.test(q)) return [(opts.cycleBroken ?? []).map((id) => ({ id })), (opts.cycleBroken ?? []).length];
      if (/RETURNING p\.id/.test(q)) return [(opts.filled ?? []).map((id) => ({ id })), (opts.filled ?? []).length];
      if (/COUNT\(\*\) AS n/.test(q)) return [{ n: '3' }];
      return [];
    }),
  };
  return { qr, sql };
}

describe('Migración 051 · «Reporta a» y «Supervisa a» como referencias entre puestos', () => {
  let log: jest.SpyInstance;
  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => log.mockRestore());

  it('crea la columna, la tabla de supervisiones y los CHECK de autorreferencia, todo idempotente', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const all = sql.join('\n');
    expect(all).toContain('ADD COLUMN IF NOT EXISTS reports_to_position_id UUID NULL');
    expect(all).toContain('FOREIGN KEY (reports_to_position_id) REFERENCES hr.job_positions(id)');
    expect(all).toContain('CHECK (reports_to_position_id IS NULL OR reports_to_position_id <> id)');
    expect(all).toContain('CREATE INDEX IF NOT EXISTS idx_job_positions_reports_to_position');
    expect(all).toContain('WHERE reports_to_position_id IS NOT NULL');
    expect(all).toContain('CREATE TABLE IF NOT EXISTS hr.job_position_supervisions');
    expect(all).toContain('PRIMARY KEY (supervisor_position_id, supervised_position_id)');
    expect(all).toContain('CHECK (supervisor_position_id <> supervised_position_id)');
    expect(all).toContain('CREATE INDEX IF NOT EXISTS idx_job_position_supervisions_supervised');
    expect(all.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('amplía supervises_text a TEXT y no borra ni cambia reports_to_text, supervises_text ni reports_to_employee_id', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    expect(sql.some((q) => /ALTER COLUMN supervises_text TYPE TEXT/.test(q))).toBe(true);
    expect(sql.some((q) => /DROP COLUMN|SET reports_to_text|SET supervises_text|SET reports_to_employee_id/.test(q))).toBe(false);
  });

  it('el relleno solo toca filas con reports_to_position_id NULL, misma división, coincidencia ÚNICA y distinta del propio puesto', async () => {
    const { qr, sql } = runner({ filled: ['a', 'b'] });
    await new Migration().up(qr as never);
    const fill = sql.find((q) => /UPDATE hr\.job_positions p SET reports_to_position_id = c\.rid/.test(q))!;
    expect(fill).toContain('c.matches = 1');
    expect(fill).toContain('p.reports_to_position_id IS NULL');
    expect(fill).toContain('b.dk = a.dk'); // misma división
    expect(fill).toContain('b.tk = a.rk'); // título normalizado = texto normalizado
    expect(fill).toContain('b.id <> a.id'); // no el propio puesto
    expect(fill).toContain('deleted_at IS NULL'); // solo puestos vivos
    expect(fill).toContain("translate(COALESCE(");
    expect(fill).toContain('lower(btrim(regexp_replace(');
  });

  it('si el relleno cerró un ciclo, los puestos rellenados que lo forman vuelven a NULL', async () => {
    const { qr, sql } = runner({ filled: ['a', 'b', 'c'], cycleBroken: ['a', 'b'] });
    await new Migration().up(qr as never);
    const cyc = sql.find((q) => /WITH RECURSIVE walk/.test(q))!;
    expect(cyc).toContain('SET reports_to_position_id = NULL');
    expect(cyc).toContain('p.id = ANY($1::uuid[])'); // solo los rellenados por la migración
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/RELLENADOS=1 \(dejados en NULL por formar ciclo=2\)/);
  });

  it('sin puestos rellenados no busca ciclos', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    expect(sql.some((q) => /WITH RECURSIVE/.test(q))).toBe(false);
  });

  it('reporta el PRE: puestos vivos, con reports_to_text, rellenables y ambiguos', async () => {
    const { qr } = runner();
    await new Migration().up(qr as never);
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/PRE: puestos vivos=3, con reports_to_text=3, rellenables=3, ambiguos=3/);
  });

  it('down quita lo creado sin borrar columnas de texto', async () => {
    const { qr, sql } = runner();
    await new Migration().down(qr as never);
    expect(sql.join('\n')).toContain('DROP TABLE IF EXISTS hr.job_position_supervisions');
    expect(sql.join('\n')).toContain('DROP COLUMN IF EXISTS reports_to_position_id');
    expect(sql.some((q) => /reports_to_text|supervises_text|reports_to_employee_id/.test(q))).toBe(false);
  });
});
