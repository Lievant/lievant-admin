import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Puestos: «Reporta a» y «Supervisa a» como referencias entre puestos.
 *
 *  - `hr.job_positions.reports_to_position_id`: FK al mismo puesto (nulable, índice parcial, nunca a sí mismo).
 *  - `hr.job_position_supervisions`: quién supervisa a quién (PK compuesta, FK a ambos lados, nunca a sí mismo).
 *  - `supervises_text` pasa a TEXT (guarda el texto original de la celda del Excel).
 *  - Relleno seguro de `reports_to_position_id` solo donde esté NULL: si `reports_to_text`, normalizado (sin acentos,
 *    minúsculas, espacios simples), coincide con el título de UN solo puesto vivo de la MISMA división y distinto del
 *    propio puesto. Sin coincidencia única no se toca. Si el relleno formara un ciclo, esos puestos se dejan en NULL.
 *
 * No se borra ni se cambia `reports_to_text`, `supervises_text` ni `reports_to_employee_id`. Las relaciones con puestos
 * dados de baja lógica se ignoran en las lecturas (filtro `deleted_at IS NULL`) y el servicio las limpia al dar de baja.
 *
 * Idempotente. DESPLIEGUE: primero el código nuevo y después esta migración (el código viejo no conoce estas columnas
 * y no se rompe con ellas, pero el nuevo las necesita). `down()` quita lo creado; `supervises_text` se queda en TEXT.
 */
export class JobPositionRelations1751000000051 implements MigrationInterface {
  name = 'JobPositionRelations1751000000051';

  /** SQL de normalización de texto: sin acentos, minúsculas y espacios simples. */
  private static norm(col: string): string {
    return `lower(btrim(regexp_replace(translate(COALESCE(${col}, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'), '\\s+', ' ', 'g')))`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const N = JobPositionRelations1751000000051.norm;
    const count = async (sql: string): Promise<number> => Number(((await queryRunner.query(sql)) as { n: string }[])[0]?.n ?? 0);

    await queryRunner.query(`ALTER TABLE hr.job_positions ADD COLUMN IF NOT EXISTS reports_to_position_id UUID NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_positions_reports_to_position') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT fk_job_positions_reports_to_position
            FOREIGN KEY (reports_to_position_id) REFERENCES hr.job_positions(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_position_reports_to_not_self') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT chk_job_position_reports_to_not_self
            CHECK (reports_to_position_id IS NULL OR reports_to_position_id <> id);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_positions_reports_to_position
      ON hr.job_positions (reports_to_position_id) WHERE reports_to_position_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_position_supervisions (
        supervisor_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        supervised_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (supervisor_position_id, supervised_position_id),
        CONSTRAINT chk_job_position_supervision_not_self CHECK (supervisor_position_id <> supervised_position_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_position_supervisions_supervised
      ON hr.job_position_supervisions (supervised_position_id)
    `);
    await queryRunner.query(`ALTER TABLE hr.job_positions ALTER COLUMN supervises_text TYPE TEXT`);

    // PRE: cuántos puestos hay y cuántos se pueden rellenar (coincidencia única en la misma división).
    const base = `
      WITH n AS (
        SELECT id, ${N('division')} AS dk, ${N('title')} AS tk, ${N('reports_to_text')} AS rk, reports_to_position_id AS rp
        FROM hr.job_positions WHERE deleted_at IS NULL
      ), cand AS (
        SELECT a.id AS pid, COUNT(b.id) AS matches, (array_agg(b.id))[1] AS rid
        FROM n a JOIN n b ON b.dk = a.dk AND b.tk = a.rk AND b.id <> a.id
        WHERE a.rk <> '' AND a.dk <> '' AND a.rp IS NULL
        GROUP BY a.id
      )`;
    const pre = {
      vivos: await count(`SELECT COUNT(*) AS n FROM hr.job_positions WHERE deleted_at IS NULL`),
      conTexto: await count(`SELECT COUNT(*) AS n FROM hr.job_positions WHERE deleted_at IS NULL AND btrim(COALESCE(reports_to_text, '')) <> ''`),
      rellenables: await count(`${base} SELECT COUNT(*) AS n FROM cand WHERE matches = 1`),
      ambiguos: await count(`${base} SELECT COUNT(*) AS n FROM cand WHERE matches > 1`),
    };

    // Relleno solo donde esté NULL y la coincidencia sea única.
    const filled = (await queryRunner.query(
      `${base}
       UPDATE hr.job_positions p SET reports_to_position_id = c.rid, updated_at = NOW()
       FROM cand c WHERE p.id = c.pid AND c.matches = 1 AND p.reports_to_position_id IS NULL
       RETURNING p.id`,
    )) as unknown;
    const filledIds = (Array.isArray(filled) ? (Array.isArray(filled[0]) ? filled[0] : filled) : []) as { id: string }[];
    const ids = filledIds.map((r) => r.id);

    // Si el relleno cerró un ciclo (A→B→A, o más largo), esos puestos rellenados vuelven a NULL.
    let cycleBroken = 0;
    if (ids.length > 0) {
      const res = (await queryRunner.query(
        `WITH RECURSIVE walk(start_id, cur_id, depth) AS (
           SELECT id, reports_to_position_id, 1 FROM hr.job_positions WHERE reports_to_position_id IS NOT NULL AND deleted_at IS NULL
           UNION ALL
           SELECT w.start_id, p.reports_to_position_id, w.depth + 1
           FROM walk w JOIN hr.job_positions p ON p.id = w.cur_id
           WHERE p.reports_to_position_id IS NOT NULL AND p.deleted_at IS NULL AND w.depth < 60 AND w.cur_id <> w.start_id
         ), cyclic AS (SELECT DISTINCT start_id FROM walk WHERE cur_id = start_id)
         UPDATE hr.job_positions p SET reports_to_position_id = NULL, updated_at = NOW()
         FROM cyclic c WHERE p.id = c.start_id AND p.id = ANY($1::uuid[])
         RETURNING p.id`,
        [ids],
      )) as unknown;
      const rows = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
      cycleBroken = rows.length;
    }

    console.log(
      `MIGRACION 051 · PRE: puestos vivos=${pre.vivos}, con reports_to_text=${pre.conTexto}, rellenables=${pre.rellenables}, ` +
        `ambiguos=${pre.ambiguos} · RELLENADOS=${ids.length - cycleBroken} (dejados en NULL por formar ciclo=${cycleBroken})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_position_supervisions_supervised`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_position_supervisions`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_reports_to_position`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS chk_job_position_reports_to_not_self`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS fk_job_positions_reports_to_position`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP COLUMN IF EXISTS reports_to_position_id`);
  }
}
