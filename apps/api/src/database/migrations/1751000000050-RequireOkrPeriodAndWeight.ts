import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OKRs de puesto: semestre obligatorio y peso entero de 1 a 100.
 *
 * Regla de negocio: ya no existe la «plantilla sin periodo» y el peso es obligatorio y entero. La columna `weight`
 * sigue siendo DECIMAL(5,2) (no se cambia el tipo): lo entero lo imponen la validación del API y el CHECK nuevo.
 *
 * Limpieza de datos (solo `hr.job_position_okrs`; `hr.employee_okrs` NO se toca):
 *   1. Filas vivas sin periodo (plantillas viejas): baja lógica.
 *   2. Pesos con decimales: redondeo hacia abajo (floor), así la suma nunca pasa de 100. Si queda en 0 (o el peso
 *      era menor a 1) se tratan como filas sin peso.
 *   3. Filas inactivas sin peso: baja lógica.
 *   4. Filas activas sin peso: por puesto y semestre se reparte la capacidad restante (100 menos la suma de los
 *      demás pesos activos) en partes iguales con enteros: base = floor(capacidad / n) y los primeros
 *      `capacidad % n` (por sort_order, created_at, id) reciben una unidad más. Si no alcanza 1 por fila, baja lógica.
 *   5. Se verifica que ningún puesto-semestre quede con suma > 100 (si quedara, se aborta sin cambiar nada).
 *
 * Constraints con nombre, idempotentes y que no estorban a las filas dadas de baja (por eso no NOT NULL a secas).
 *
 * DESPLIEGUE: se corre DESPUÉS de desplegar el código nuevo, porque el código viejo todavía inserta OKRs con
 * periodo NULL y este CHECK los rechazaría. `down()` solo quita los CHECK: las bajas lógicas y los redondeos no
 * se pueden revertir.
 */
export class RequireOkrPeriodAndWeight1751000000050 implements MigrationInterface {
  name = 'RequireOkrPeriodAndWeight1751000000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const count = async (sql: string): Promise<number> => Number(((await queryRunner.query(sql)) as { n: string }[])[0]?.n ?? 0);
    const LIVE = `deleted_at IS NULL`;

    // PRE: cuántas filas vivas hay de cada tipo (se reporta al final).
    const pre = {
      sinPeriodo: await count(`SELECT COUNT(*) AS n FROM hr.job_position_okrs WHERE ${LIVE} AND period IS NULL`),
      sinPeso: await count(`SELECT COUNT(*) AS n FROM hr.job_position_okrs WHERE ${LIVE} AND period IS NOT NULL AND weight IS NULL`),
      pesoMenorA1: await count(`SELECT COUNT(*) AS n FROM hr.job_position_okrs WHERE ${LIVE} AND period IS NOT NULL AND weight IS NOT NULL AND weight < 1`),
      pesoConDecimales: await count(`SELECT COUNT(*) AS n FROM hr.job_position_okrs WHERE ${LIVE} AND period IS NOT NULL AND weight IS NOT NULL AND weight >= 1 AND weight <> trunc(weight)`),
      puestosSemestreSumaMayorA100: await count(
        `SELECT COUNT(*) AS n FROM (SELECT 1 FROM hr.job_position_okrs WHERE ${LIVE} AND is_active AND period IS NOT NULL
           GROUP BY job_position_id, period HAVING SUM(COALESCE(weight, 0)) > 100) t`,
      ),
    };

    // 1. Plantillas viejas (sin periodo): baja lógica.
    const plantillas = await count(
      `WITH d AS (UPDATE hr.job_position_okrs SET deleted_at = NOW(), updated_at = NOW()
                  WHERE ${LIVE} AND period IS NULL RETURNING 1) SELECT COUNT(*) AS n FROM d`,
    );

    // 2. Decimales hacia abajo; si queda en 0 (o ya era menor a 1) se trata como sin peso (NULL, se resuelve en 3 y 4).
    const redondeadas = await count(
      `WITH d AS (UPDATE hr.job_position_okrs SET weight = CASE WHEN floor(weight) >= 1 THEN floor(weight) ELSE NULL END, updated_at = NOW()
                  WHERE ${LIVE} AND weight IS NOT NULL AND (weight <> trunc(weight) OR weight < 1) RETURNING 1) SELECT COUNT(*) AS n FROM d`,
    );

    // 3. Inactivas sin peso: baja lógica.
    const inactivasSinPeso = await count(
      `WITH d AS (UPDATE hr.job_position_okrs SET deleted_at = NOW(), updated_at = NOW()
                  WHERE ${LIVE} AND is_active = false AND weight IS NULL RETURNING 1) SELECT COUNT(*) AS n FROM d`,
    );

    // 4. Activas sin peso: reparto equitativo con enteros de la capacidad restante por puesto y semestre.
    const reparto = (await queryRunner.query(
      `WITH g AS (
         SELECT job_position_id, period,
                100 - COALESCE(SUM(weight) FILTER (WHERE weight IS NOT NULL), 0) AS cap,
                COUNT(*) FILTER (WHERE weight IS NULL) AS n
         FROM hr.job_position_okrs
         WHERE ${LIVE} AND is_active = true AND period IS NOT NULL
         GROUP BY job_position_id, period
         HAVING COUNT(*) FILTER (WHERE weight IS NULL) > 0
       ), r AS (
         SELECT o.id, g.cap, g.n,
                ROW_NUMBER() OVER (PARTITION BY o.job_position_id, o.period ORDER BY o.sort_order, o.created_at, o.id) AS rn
         FROM hr.job_position_okrs o
         JOIN g ON g.job_position_id = o.job_position_id AND g.period = o.period
         WHERE o.deleted_at IS NULL AND o.is_active = true AND o.weight IS NULL AND o.period IS NOT NULL
       ), u AS (
         UPDATE hr.job_position_okrs o SET
           weight = CASE WHEN floor(r.cap / r.n) >= 1 THEN floor(r.cap / r.n) + CASE WHEN r.rn <= mod(r.cap::bigint, r.n) THEN 1 ELSE 0 END END,
           deleted_at = CASE WHEN floor(r.cap / r.n) >= 1 THEN NULL ELSE NOW() END,
           updated_at = NOW()
         FROM r WHERE o.id = r.id
         RETURNING (o.deleted_at IS NOT NULL) AS dada_de_baja
       )
       SELECT COUNT(*) FILTER (WHERE NOT dada_de_baja) AS con_peso, COUNT(*) FILTER (WHERE dada_de_baja) AS de_baja FROM u`,
    )) as { con_peso: string; de_baja: string }[];

    // 5. Ningún puesto-semestre puede quedar por encima de 100.
    const sobrantes = await count(
      `SELECT COUNT(*) AS n FROM (SELECT 1 FROM hr.job_position_okrs WHERE ${LIVE} AND is_active AND period IS NOT NULL
         GROUP BY job_position_id, period HAVING SUM(weight) > 100) t`,
    );
    if (sobrantes > 0) {
      throw new Error(
        `Migración 050 abortada: ${sobrantes} puesto(s)/semestre(s) tienen OKRs activos con suma de pesos mayor a 100 ` +
          `incluso después del redondeo. Corrígelos a mano y vuelve a correr la migración.`,
      );
    }

    // Constraints con nombre, idempotentes; no estorban a las filas ya dadas de baja.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_position_okr_period_required'
                       AND conrelid = 'hr.job_position_okrs'::regclass) THEN
          ALTER TABLE hr.job_position_okrs ADD CONSTRAINT chk_job_position_okr_period_required
            CHECK (deleted_at IS NOT NULL OR period IS NOT NULL);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_position_okr_weight_required'
                       AND conrelid = 'hr.job_position_okrs'::regclass) THEN
          ALTER TABLE hr.job_position_okrs ADD CONSTRAINT chk_job_position_okr_weight_required
            CHECK (deleted_at IS NOT NULL OR (weight IS NOT NULL AND weight >= 1 AND weight <= 100 AND weight = trunc(weight)));
        END IF;
      END $$
    `);

    console.log(
      `MIGRACION 050 · PRE: sin periodo=${pre.sinPeriodo}, sin peso=${pre.sinPeso}, peso<1=${pre.pesoMenorA1}, ` +
        `con decimales=${pre.pesoConDecimales}, puesto-semestre con suma>100=${pre.puestosSemestreSumaMayorA100} · ` +
        `AFECTADAS: plantillas dadas de baja=${plantillas}, pesos redondeados o a NULL=${redondeadas}, ` +
        `inactivas sin peso dadas de baja=${inactivasSinPeso}, activas con peso repartido=${reparto[0]?.con_peso ?? 0}, ` +
        `activas dadas de baja por falta de capacidad=${reparto[0]?.de_baja ?? 0}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hr.job_position_okrs DROP CONSTRAINT IF EXISTS chk_job_position_okr_weight_required`);
    await queryRunner.query(`ALTER TABLE hr.job_position_okrs DROP CONSTRAINT IF EXISTS chk_job_position_okr_period_required`);
  }
}
