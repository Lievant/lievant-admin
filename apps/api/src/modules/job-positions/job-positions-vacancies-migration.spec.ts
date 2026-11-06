import { JobPositionVacanciesAndAiLevel1751000000052 as Migration } from '../../database/migrations/1751000000052-JobPositionVacanciesAndAiLevel';

function runner() {
  const sql: string[] = [];
  return { qr: { query: jest.fn(async (q: string) => (sql.push(q), [])) }, sql };
}

describe('Migración 052 · Vacantes y Competencia IA', () => {
  it('agrega las columnas de forma idempotente con sus CHECK nombrados', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const all = sql.join('\n');
    expect(all).toContain('ADD COLUMN IF NOT EXISTS vacancies INTEGER NOT NULL DEFAULT 0');
    expect(all).toContain('ADD COLUMN IF NOT EXISTS ai_competency_level VARCHAR(20) NULL');
    expect(all).toContain('chk_job_position_vacancies_nonneg CHECK (vacancies >= 0)');
    expect(all).toContain("chk_job_position_ai_level");
    expect(all).toContain("CHECK (ai_competency_level IN ('basico', 'intermedio', 'avanzado'))");
    expect(all.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint/g)).toHaveLength(2);
  });

  it('el relleno convierte «0 plazas» en 1 vacante solo en puestos vivos que aún no tienen vacantes, y va después del DDL', async () => {
    const { qr, sql } = runner();
    await new Migration().up(qr as never);
    const upd = sql.findIndex((q) => /^UPDATE hr\.job_positions SET vacancies = 1/.test(q));
    expect(sql[upd]).toContain('WHERE plazas = 0 AND deleted_at IS NULL AND vacancies = 0');
    expect(upd).toBe(sql.length - 1);
    expect(sql.some((q) => /RENAME|DROP COLUMN plazas/i.test(q))).toBe(false);
  });

  it('down quita CHECK y columnas', async () => {
    const { qr, sql } = runner();
    await new Migration().down(qr as never);
    expect(sql.join('\n')).toContain('DROP COLUMN IF EXISTS vacancies');
    expect(sql.join('\n')).toContain('DROP COLUMN IF EXISTS ai_competency_level');
    expect(sql.join('\n')).toContain('DROP CONSTRAINT IF EXISTS chk_job_position_ai_level');
  });
});
