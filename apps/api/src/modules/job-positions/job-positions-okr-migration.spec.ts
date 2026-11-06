import { RequireOkrPeriodAndWeight1751000000050 as Migration } from '../../database/migrations/1751000000050-RequireOkrPeriodAndWeight';

/** QueryRunner simulado: registra el SQL; los conteos y el reparto salen de lo que se le indique. */
function runner(opts: { sobrantes?: number } = {}) {
  const sql: string[] = [];
  const qr = {
    query: jest.fn(async (q: string) => {
      sql.push(q);
      if (/SELECT COUNT\(\*\) AS n FROM \(SELECT 1 FROM hr\.job_position_okrs[\s\S]*SUM\(weight\) > 100/.test(q)) return [{ n: String(opts.sobrantes ?? 0) }];
      if (/COUNT\(\*\) FILTER \(WHERE NOT dada_de_baja\)/.test(q)) return [{ con_peso: '5', de_baja: '3' }];
      if (/COUNT\(\*\) AS n/.test(q)) return [{ n: '2' }];
      return [];
    }),
  };
  return { qr, sql };
}

describe('Migración 050 · OKRs de puesto con semestre y peso entero obligatorios', () => {
  let log: jest.SpyInstance;
  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => log.mockRestore());

  it('da de baja lógica las plantillas sin periodo y nunca toca hr.employee_okrs', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const tpl = sql.find((q) => /period IS NULL RETURNING/.test(q))!;
    expect(tpl).toContain('SET deleted_at = NOW()');
    expect(tpl).toContain('deleted_at IS NULL AND period IS NULL');
    expect(sql.some((q) => /employee_okrs/.test(q))).toBe(false);
    expect(sql.some((q) => /DELETE FROM/i.test(q))).toBe(false); // todo es baja lógica
  });

  it('redondea los decimales hacia abajo (floor) y, si queda en 0 o era menor a 1, lo trata como sin peso (NULL)', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const round = sql.find((q) => /floor\(weight\)/.test(q))!;
    expect(round).toContain('CASE WHEN floor(weight) >= 1 THEN floor(weight) ELSE NULL END');
    expect(round).toContain('weight <> trunc(weight) OR weight < 1');
    expect(round).not.toMatch(/round\(|ceil/i); // nunca hacia arriba: la suma no puede pasar de 100
  });

  it('da de baja las inactivas sin peso y reparte la capacidad de las activas con enteros (base + resto) o las da de baja si no alcanza', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    expect(sql.some((q) => /is_active = false AND weight IS NULL RETURNING/.test(q) && /deleted_at = NOW\(\)/.test(q))).toBe(true);
    const split = sql.find((q) => /dada_de_baja/.test(q))!;
    expect(split).toContain('100 - COALESCE(SUM(weight) FILTER (WHERE weight IS NOT NULL), 0) AS cap');
    expect(split).toContain('floor(r.cap / r.n) + CASE WHEN r.rn <= mod(r.cap::bigint, r.n) THEN 1 ELSE 0 END');
    expect(split).toContain('CASE WHEN floor(r.cap / r.n) >= 1 THEN NULL ELSE NOW() END'); // sin capacidad: baja lógica
    expect(split).toContain('ORDER BY o.sort_order, o.created_at, o.id');
  });

  it('las constraints tienen nombre, son idempotentes y no estorban a las filas dadas de baja', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const period = sql.find((q) => /chk_job_position_okr_period_required/.test(q) && /ADD CONSTRAINT/.test(q))!;
    const weight = sql.find((q) => /chk_job_position_okr_weight_required/.test(q) && /ADD CONSTRAINT/.test(q))!;
    expect(period).toContain('IF NOT EXISTS (SELECT 1 FROM pg_constraint');
    expect(period).toContain('CHECK (deleted_at IS NOT NULL OR period IS NOT NULL)');
    expect(weight).toContain('IF NOT EXISTS (SELECT 1 FROM pg_constraint');
    expect(weight).toContain('CHECK (deleted_at IS NOT NULL OR (weight IS NOT NULL AND weight >= 1 AND weight <= 100 AND weight = trunc(weight)))');
  });

  it('las constraints se agregan DESPUÉS de limpiar los datos, y no se cambia el tipo de la columna', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const lastClean = Math.max(...sql.map((q, i) => (/UPDATE hr\.job_position_okrs|WITH g AS/.test(q) ? i : -1)));
    const firstAdd = sql.findIndex((q) => /ADD CONSTRAINT/.test(q));
    expect(firstAdd).toBeGreaterThan(lastClean);
    expect(sql.some((q) => /ALTER COLUMN|TYPE /i.test(q))).toBe(false);
  });

  it('si después del redondeo queda un puesto-semestre con suma > 100, aborta sin agregar constraints', async () => {
    const { qr, sql } = runner({ sobrantes: 2 });
    await expect(new Migration().up(qr as never)).rejects.toThrow(/abortada: 2 puesto\(s\)\/semestre\(s\).*mayor a 100/);
    expect(sql.some((q) => /ADD CONSTRAINT/.test(q))).toBe(false);
  });

  it('reporta cuántas filas se afectaron de cada tipo', async () => {
    const { qr } = runner();
    await new Migration().up(qr as never);
    const msg = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(msg).toMatch(/MIGRACION 050 · PRE: sin periodo=2, sin peso=2, peso<1=2, con decimales=2/);
    expect(msg).toMatch(/plantillas dadas de baja=2/);
    expect(msg).toMatch(/activas con peso repartido=5/);
    expect(msg).toMatch(/activas dadas de baja por falta de capacidad=3/);
  });

  it('down solo quita las dos constraints (los datos limpiados no se revierten)', async () => {
    const { qr, sql } = runner();
    await new Migration().down(qr as never);
    expect(sql).toHaveLength(2);
    expect(sql.every((q) => /DROP CONSTRAINT IF EXISTS chk_job_position_okr_(weight|period)_required/.test(q))).toBe(true);
  });
});
