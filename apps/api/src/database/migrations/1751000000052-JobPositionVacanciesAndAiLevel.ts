import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Puestos: Vacantes y Competencia IA (nivel).
 *
 *  - `hr.job_positions.vacancies INTEGER NOT NULL DEFAULT 0` (CHECK >= 0): vacantes, separadas de las plazas ocupadas
 *    (`plazas`, que no se renombra ni se cambia).
 *  - `hr.job_positions.ai_competency_level VARCHAR(20) NULL` (CHECK basico / intermedio / avanzado, sin acentos y en
 *    minúsculas; la UI muestra Básico / Intermedio / Avanzado).
 *  - Relleno: hasta hoy «0 plazas» significaba «Vacante». Para conservar ese significado, los puestos vivos con
 *    `plazas = 0` y `vacancies = 0` pasan a `vacancies = 1`. Idempotente (un segundo `up` no encuentra filas con 0).
 *
 * Idempotente. DESPLIEGUE: primero el código nuevo y después esta migración. `down()` quita las columnas (las vacantes
 * y el nivel de IA capturados se pierden).
 */
export class JobPositionVacanciesAndAiLevel1751000000052 implements MigrationInterface {
  name = 'JobPositionVacanciesAndAiLevel1751000000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hr.job_positions ADD COLUMN IF NOT EXISTS vacancies INTEGER NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE hr.job_positions ADD COLUMN IF NOT EXISTS ai_competency_level VARCHAR(20) NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_position_vacancies_nonneg'
                       AND conrelid = 'hr.job_positions'::regclass) THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT chk_job_position_vacancies_nonneg CHECK (vacancies >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_position_ai_level'
                       AND conrelid = 'hr.job_positions'::regclass) THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT chk_job_position_ai_level
            CHECK (ai_competency_level IN ('basico', 'intermedio', 'avanzado'));
        END IF;
      END $$
    `);
    // Antes «0 plazas» era «Vacante»: ese significado se conserva como 1 vacante.
    await queryRunner.query(`UPDATE hr.job_positions SET vacancies = 1 WHERE plazas = 0 AND deleted_at IS NULL AND vacancies = 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS chk_job_position_ai_level`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS chk_job_position_vacancies_nonneg`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP COLUMN IF EXISTS ai_competency_level`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP COLUMN IF EXISTS vacancies`);
  }
}
