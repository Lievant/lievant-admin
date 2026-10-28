import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Puestos: Categoría (seniority), nivel original del Excel y niveles V–IX de la escala oficial.
 *
 *  - `catalogs.org_levels` es la ÚNICA escala de niveles (empleados y puestos). Aquí solo se agregan, si no
 *    existen, los niveles V a IX; I a IV no se tocan (se renombran en Admin › Catálogos, coordinado con RRHH).
 *  - `hr.job_positions.seniority`: categoría Junior / Semi Senior / Senior (CHECK, nulable).
 *  - `hr.job_positions.level_original`: texto del nivel tal como venía en el Excel (solo lectura en la pantalla),
 *    para no perder valores ambiguos como «V / VI» o «Sin nivel (MEOT: III)».
 *  - Las áreas usan el `catalogs.areas` que ya existe (con `division_name`); no se siembra nada.
 *
 * Aditiva e idempotente (`org_levels.code` es único). `down()` quita las columnas nuevas y borra la tabla
 * `catalogs.job_position_levels` (de una versión anterior de esta migración, solo existe en BD locales); los
 * niveles V–IX agregados a `org_levels` se dejan, porque pueden estar en uso.
 */
export class JobPositionCatalogs1751000000042 implements MigrationInterface {
  name = 'JobPositionCatalogs1751000000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO catalogs.org_levels (code, name, sort_order)
      VALUES ('V', 'Especialista Senior / Key Account', 4),
             ('VI', 'Senior', 5),
             ('VII', 'Semi Senior', 6),
             ('VIII', 'Junior / Auxiliar', 7),
             ('IX', 'Practicante / Trainee', 8)
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
