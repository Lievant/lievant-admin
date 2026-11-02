import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Capacitaciones: competencias del catálogo y fuera «Reconocimiento de la Empresa».
 *
 *  - `employees.training_competencies`: liga cada capacitación con las competencias de `catalogs.competencies`
 *    (llave primaria compuesta, índice por competencia para contar en qué capacitaciones se usa).
 *  - Se quita `employees.employee_trainings.is_company_recognition`.
 *
 * Idempotente. NO se hace backfill: las capacitaciones que ya existen se quedan sin competencias (el formulario
 * exige al menos una cuando se editan desde el modal). La migración 036, que ya corrió en staging y producción,
 * no se toca.
 *
 * `down()` vuelve a agregar `is_company_recognition BOOLEAN NOT NULL DEFAULT false` y borra
 * `training_competencies`. OJO: el valor anterior del checkbox NO se puede recuperar (todas quedan en false) y
 * las ligas a competencias se pierden.
 */
export class TrainingCompetencies1751000000048 implements MigrationInterface {
  name = 'TrainingCompetencies1751000000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employees.training_competencies (
        training_id   UUID NOT NULL REFERENCES employees.employee_trainings(id),
        competency_id UUID NOT NULL REFERENCES catalogs.competencies(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (training_id, competency_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_training_competencies_competency
      ON employees.training_competencies (competency_id)
    `);
    await queryRunner.query(`ALTER TABLE employees.employee_trainings DROP COLUMN IF EXISTS is_company_recognition`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees.employee_trainings
        ADD COLUMN IF NOT EXISTS is_company_recognition BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS employees.idx_training_competencies_competency`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.training_competencies`);
  }
}
