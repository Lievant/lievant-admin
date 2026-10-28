import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Puestos: Nivel, Categoría y Área como listas cerradas.
 *
 *  - `catalogs.job_position_levels`: niveles de los puestos (I–VIII). Es aparte de `catalogs.org_levels`
 *    (niveles de los empleados, I–IV), que no se toca.
 *  - `hr.job_positions.seniority`: categoría Junior / Semi Senior / Senior (CHECK, nulable).
 *  - `hr.job_positions.level_original`: texto del nivel tal como venía en el Excel (solo lectura en la pantalla),
 *    para no perder valores ambiguos como «V / VI» o «Sin nivel (MEOT: III)».
 *  - Las áreas usan el `catalogs.areas` que ya existe (con `division_name`); no se siembra nada.
 *
 * Aditiva e idempotente. `down()` quita las columnas y la tabla nuevas.
 */
export class JobPositionCatalogs1751000000042 implements MigrationInterface {
  name = 'JobPositionCatalogs1751000000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.job_position_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(10) NOT NULL,
        name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        sort_order SMALLINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_job_position_levels_code ON catalogs.job_position_levels (code)
    `);
    await queryRunner.query(`
      INSERT INTO catalogs.job_position_levels (code, name, sort_order)
      VALUES ('I','Nivel I',0),('II','Nivel II',1),('III','Nivel III',2),('IV','Nivel IV',3),
             ('V','Nivel V',4),('VI','Nivel VI',5),('VII','Nivel VII',6),('VIII','Nivel VIII',7)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE hr.job_positions
        ADD COLUMN IF NOT EXISTS seniority VARCHAR(20),
        ADD COLUMN IF NOT EXISTS level_original VARCHAR(100)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_positions_seniority_check') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT job_positions_seniority_check
            CHECK (seniority IS NULL OR seniority IN ('junior','semi_senior','senior'));
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS job_positions_seniority_check`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP COLUMN IF EXISTS level_original, DROP COLUMN IF EXISTS seniority`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.job_position_levels`);
  }
}
